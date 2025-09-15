import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'ion:settings-outline',
      order: 9997,
      title: $t('itsupport.title'),
    },
    name: 'Itsupport',
    path: '/itsupport',
    children: [
      {
        path: '/itsupport/basic',
        name: 'ItsupportBasic',
        meta: {
          icon: 'mdi:account-group',
          title: $t('itsupport.basic.title'),
        },
        component: () => import('#/views/itsupport/basic/publish.vue'),
      },
    ],
  },
];

export default routes;
