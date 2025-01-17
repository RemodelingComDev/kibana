/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getPageObjects, getService }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const security = getService('security');
  const kibanaServer = getService('kibanaServer');
  const PageObjects = getPageObjects([
    'common',
    'error',
    'header',
    'security',
    'spaceSelector',
    'timelion',
  ]);
  const appsMenu = getService('appsMenu');
  const globalNav = getService('globalNav');

  describe('feature controls security', () => {
    before(async () => {
      await kibanaServer.importExport.load(
        'x-pack/test/functional/fixtures/kbn_archiver/timelion/feature_controls.json'
      );
      await esArchiver.loadIfNeeded('x-pack/test/functional/es_archives/logstash_functional');
    });

    after(async () => {
      await kibanaServer.importExport.unload(
        'x-pack/test/functional/fixtures/kbn_archiver/timelion/feature_controls.json'
      );
      await esArchiver.unload('x-pack/test/functional/es_archives/logstash_functional');
    });

    // FLAKY: https://github.com/elastic/kibana/issues/110396
    describe.skip('global timelion all privileges', () => {
      before(async () => {
        await security.role.create('global_timelion_all_role', {
          elasticsearch: {
            indices: [{ names: ['logstash-*'], privileges: ['read', 'view_index_metadata'] }],
          },
          kibana: [
            {
              feature: {
                timelion: ['all'],
              },
              spaces: ['*'],
            },
          ],
        });

        await security.user.create('global_timelion_all_user', {
          password: 'global_timelion_all_user-password',
          roles: ['global_timelion_all_role'],
          full_name: 'test user',
        });

        await PageObjects.security.forceLogout();

        await PageObjects.security.login(
          'global_timelion_all_user',
          'global_timelion_all_user-password',
          {
            expectSpaceSelector: false,
          }
        );
      });

      after(async () => {
        await PageObjects.security.forceLogout();
        await security.role.delete('global_timelion_all_role');
        await security.user.delete('global_timelion_all_user');
      });

      it('shows timelion navlink', async () => {
        const navLinks = (await appsMenu.readLinks()).map((link) => link.text);
        expect(navLinks).to.eql(['Overview', 'Timelion']);
      });

      it(`allows a timelion sheet to be created`, async () => {
        await PageObjects.common.navigateToApp('timelion');
        await PageObjects.timelion.saveTimelionSheet();
      });

      it(`doesn't show read-only badge`, async () => {
        await globalNav.badgeMissingOrFail();
      });
    });

    describe('global timelion read-only privileges', () => {
      before(async () => {
        await security.role.create('global_timelion_read_role', {
          elasticsearch: {
            indices: [{ names: ['logstash-*'], privileges: ['read', 'view_index_metadata'] }],
          },
          kibana: [
            {
              feature: {
                timelion: ['read'],
              },
              spaces: ['*'],
            },
          ],
        });

        await security.user.create('global_timelion_read_user', {
          password: 'global_timelion_read_user-password',
          roles: ['global_timelion_read_role'],
          full_name: 'test user',
        });

        await PageObjects.security.login(
          'global_timelion_read_user',
          'global_timelion_read_user-password',
          {
            expectSpaceSelector: false,
          }
        );
      });

      after(async () => {
        await PageObjects.security.forceLogout();
        await security.role.delete('global_timelion_read_role');
        await security.user.delete('global_timelion_read_user');
      });

      it('shows timelion navlink', async () => {
        const navLinks = (await appsMenu.readLinks()).map((link) => link.text);
        expect(navLinks).to.eql(['Overview', 'Timelion']);
      });

      it(`does not allow a timelion sheet to be created`, async () => {
        await PageObjects.common.navigateToApp('timelion');
        await PageObjects.timelion.expectMissingWriteControls();
      });

      it(`shows read-only badge`, async () => {
        await globalNav.badgeExistsOrFail('Read only');
      });
    });

    describe('no timelion privileges', () => {
      before(async () => {
        await security.role.create('no_timelion_privileges_role', {
          elasticsearch: {
            indices: [{ names: ['logstash-*'], privileges: ['read', 'view_index_metadata'] }],
          },
          kibana: [
            {
              feature: {
                discover: ['all'],
              },
              spaces: ['*'],
            },
          ],
        });

        await security.user.create('no_timelion_privileges_user', {
          password: 'no_timelion_privileges_user-password',
          roles: ['no_timelion_privileges_role'],
          full_name: 'test user',
        });

        await PageObjects.security.forceLogout();

        await PageObjects.security.login(
          'no_timelion_privileges_user',
          'no_timelion_privileges_user-password',
          {
            expectSpaceSelector: false,
          }
        );
      });

      after(async () => {
        await PageObjects.security.forceLogout();
        await security.role.delete('no_timelion_privileges_role');
        await security.user.delete('no_timelion_privileges_user');
      });

      it(`returns a 403`, async () => {
        await PageObjects.common.navigateToActualUrl('timelion', '', {
          ensureCurrentUrl: false,
          shouldLoginIfPrompted: false,
        });
        PageObjects.error.expectForbidden();
      });
    });
  });
}
