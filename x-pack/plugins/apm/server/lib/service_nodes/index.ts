/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  METRIC_JAVA_HEAP_MEMORY_USED,
  METRIC_JAVA_NON_HEAP_MEMORY_USED,
  METRIC_JAVA_THREAD_COUNT,
  METRIC_PROCESS_CPU_PERCENT,
  HOST_NAME,
} from '../../../common/elasticsearch_fieldnames';
import { SERVICE_NODE_NAME_MISSING } from '../../../common/service_nodes';
import { asMutableArray } from '../../../common/utils/as_mutable_array';
import { getServiceNodesProjection } from '../../projections/service_nodes';
import { mergeProjection } from '../../projections/util/merge_projection';
import { Setup, SetupTimeRange } from '../helpers/setup_request';

const getServiceNodes = async ({
  kuery,
  setup,
  serviceName,
  environment,
}: {
  kuery: string;
  setup: Setup & SetupTimeRange;
  serviceName: string;
  environment: string;
}) => {
  const { apmEventClient } = setup;

  const projection = getServiceNodesProjection({
    kuery,
    setup,
    serviceName,
    environment,
  });

  const params = mergeProjection(projection, {
    body: {
      aggs: {
        nodes: {
          terms: {
            ...projection.body.aggs.nodes.terms,
            size: 10000,
            missing: SERVICE_NODE_NAME_MISSING,
          },
          aggs: {
            latest: {
              top_metrics: {
                metrics: asMutableArray([{ field: HOST_NAME }] as const),
                sort: {
                  '@timestamp': 'desc',
                },
              },
            },
            cpu: {
              avg: {
                field: METRIC_PROCESS_CPU_PERCENT,
              },
            },
            heapMemory: {
              avg: {
                field: METRIC_JAVA_HEAP_MEMORY_USED,
              },
            },
            nonHeapMemory: {
              avg: {
                field: METRIC_JAVA_NON_HEAP_MEMORY_USED,
              },
            },
            threadCount: {
              max: {
                field: METRIC_JAVA_THREAD_COUNT,
              },
            },
          },
        },
      },
    },
  });

  const response = await apmEventClient.search('get_service_nodes', params);

  if (!response.aggregations) {
    return [];
  }

  return response.aggregations.nodes.buckets
    .map((bucket) => ({
      name: bucket.key as string,
      cpu: bucket.cpu.value,
      heapMemory: bucket.heapMemory.value,
      hostName: bucket.latest.top?.[0]?.metrics?.['host.hostname'] as
        | string
        | null
        | undefined,
      nonHeapMemory: bucket.nonHeapMemory.value,
      threadCount: bucket.threadCount.value,
    }))
    .filter(
      (item) =>
        item.cpu !== null ||
        item.heapMemory !== null ||
        item.nonHeapMemory !== null ||
        item.threadCount != null
    );
};

export { getServiceNodes };
