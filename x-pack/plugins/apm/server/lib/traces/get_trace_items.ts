/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { QueryDslQueryContainer } from '@elastic/elasticsearch/api/types';
import { ProcessorEvent } from '../../../common/processor_event';
import {
  TRACE_ID,
  PARENT_ID,
  TRANSACTION_DURATION,
  SPAN_DURATION,
  TRANSACTION_ID,
  ERROR_LOG_LEVEL,
} from '../../../common/elasticsearch_fieldnames';
import { rangeQuery } from '../../../../observability/server';
import { Setup, SetupTimeRange } from '../helpers/setup_request';
import { PromiseValueType } from '../../../typings/common';

export async function getTraceItems(
  traceId: string,
  setup: Setup & SetupTimeRange
) {
  const { start, end, apmEventClient, config } = setup;
  const maxTraceItems = config['xpack.apm.ui.maxTraceItems'];
  const excludedLogLevels = ['debug', 'info', 'warning'];

  const errorResponsePromise = apmEventClient.search('get_trace_items', {
    apm: {
      events: [ProcessorEvent.error],
    },
    body: {
      size: maxTraceItems,
      query: {
        bool: {
          filter: [
            { term: { [TRACE_ID]: traceId } },
            ...rangeQuery(start, end),
          ],
          must_not: { terms: { [ERROR_LOG_LEVEL]: excludedLogLevels } },
        },
      },
      aggs: {
        by_transaction_id: {
          terms: {
            field: TRANSACTION_ID,
            size: maxTraceItems,
            // high cardinality
            execution_hint: 'map' as const,
          },
        },
      },
    },
  });

  const traceResponsePromise = apmEventClient.search('get_trace_span_items', {
    apm: {
      events: [ProcessorEvent.span, ProcessorEvent.transaction],
    },
    body: {
      size: maxTraceItems,
      query: {
        bool: {
          filter: [
            { term: { [TRACE_ID]: traceId } },
            ...rangeQuery(start, end),
          ] as QueryDslQueryContainer[],
          should: {
            exists: { field: PARENT_ID },
          },
        },
      },
      sort: [
        { _score: { order: 'asc' as const } },
        { [TRANSACTION_DURATION]: { order: 'desc' as const } },
        { [SPAN_DURATION]: { order: 'desc' as const } },
      ],
      track_total_hits: true,
    },
  });

  const [errorResponse, traceResponse]: [
    // explicit intermediary types to avoid TS "excessively deep" error
    PromiseValueType<typeof errorResponsePromise>,
    PromiseValueType<typeof traceResponsePromise>
  ] = (await Promise.all([errorResponsePromise, traceResponsePromise])) as any;

  const exceedsMax = traceResponse.hits.total.value > maxTraceItems;

  const items = traceResponse.hits.hits.map((hit) => hit._source);

  const errorFrequencies = {
    errorDocs: errorResponse.hits.hits.map(({ _source }) => _source),
    errorsPerTransaction:
      errorResponse.aggregations?.by_transaction_id.buckets.reduce(
        (acc, current) => {
          return {
            ...acc,
            [current.key]: current.doc_count,
          };
        },
        {} as Record<string, number>
      ) ?? {},
  };

  return {
    items,
    exceedsMax,
    ...errorFrequencies,
  };
}
