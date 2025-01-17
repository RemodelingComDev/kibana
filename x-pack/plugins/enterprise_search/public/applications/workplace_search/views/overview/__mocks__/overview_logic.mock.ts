/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DEFAULT_INITIAL_APP_DATA } from '../../../../../../common/__mocks__';
import { setMockValues as setMockKeaValues, setMockActions } from '../../../../__mocks__/kea_logic';

const { workplaceSearch: mockAppValues } = DEFAULT_INITIAL_APP_DATA;

export const mockOverviewValues = {
  accountsCount: 0,
  activityFeed: [],
  hasOrgSources: false,
  hasUsers: false,
  isOldAccount: false,
  pendingInvitationsCount: 0,
  personalSourcesCount: 0,
  sourcesCount: 0,
  dataLoading: true,
};

export const mockActions = {
  initializeOverview: jest.fn(() => ({})),
};

const mockValues = { ...mockOverviewValues, ...mockAppValues };

setMockActions({ ...mockActions });
setMockKeaValues({ ...mockValues });

export const setMockValues = (values: object) => {
  setMockKeaValues({ ...mockValues, ...values });
};
