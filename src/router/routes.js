//TODO: Work Requird -->
import i18n from '@/i18n';
import LoginLayout from '@/layouts/LoginLayout.vue';
import LoginPage from '@/views/Login/Login.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import Overview from '@/views/Overview/Overview.vue';
import VirtualMedia from '@/views/Operations/VirtualMedia/VirtualMedia.vue';
import Kvm from '@/views/Operations/Kvm';
import Policies from '@/views/SecurityAndAccess/Policies';
import Sensors from '@/views/HardwareStatus/Sensors';
import PageNotFound from '@/views/PageNotFound/PageNotFound.vue';
import KeyClear from '@/views/Operations/KeyClear/KeyClear.vue';
import RebootBmc from '@/views/Operations/RebootBmc';
import FactoryReset from '@/views/Operations/FactoryReset';
import Memory from '@/views/ResourceManagement/Memory';
import Power from '@/views/ResourceManagement/Power';
import PowerRestorePolicy from '@/views/Settings/PowerRestorePolicy';
import IBMiServiceFunctions from '@/views/Logs/IBMiServiceFunctions';

const roles = {
  administrator: 'Administrator',
  operator: 'Operator',
  readonly: 'ReadOnly',
  noaccess: 'NoAccess',
};
export const routes = [
  {
    path: '/login',
    component: LoginLayout,
    children: [
      {
        path: '',
        name: 'LoginPage',
        component: LoginPage,
      },
    ],
  },
  {
    path: '/',
    meta: {
      requiresAuth: true,
    },
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'overview',
        component: Overview,
        meta: {
          title: i18n.global.t('appPageTitle.overview'),
        },
      },
      {
        path: '/operations/virtual-media',
        name: 'virtual-media',
        component: VirtualMedia,
        meta: {
          title: i18n.global.t('appPageTitle.virtualMedia'),
          exclusiveToRoles: [roles.administrator],
        },
      },
      {
        path: '/hardware-status/sensors',
        name: 'sensors',
        component: Sensors,
        meta: {
          title: i18n.global.t('appPageTitle.sensors'),
        },
      },
      {
        path: '/logs/ibmi-service-functions',
        name: 'ibmiServiceFunctions',
        component: IBMiServiceFunctions,
        meta: {
          title: i18n.global.t('appPageTitle.ibmiServiceFunctions'),
        },
      },
      {
        path: '/operations/kvm',
        name: 'kvm',
        component: Kvm,
        meta: {
          title: i18n.global.t('appPageTitle.kvm'),
        },
      },
      {
        path: '/security-and-access/policies',
        name: 'policies',
        component: Policies,
        meta: {
          title: i18n.global.t('appPageTitle.policies'),
        },
      },
      { path: '/operations/key-clear', name: 'key-clear', component: KeyClear },
      {
        path: '/operations/reboot-bmc',
        name: 'reboot-bmc',
        component: RebootBmc,
        meta: {
          title: i18n.global.t('appPageTitle.rebootBmc'),
        },
      },

      {
        path: '/operations/factory-reset',
        name: 'factory-reset',
        component: FactoryReset,
        meta: {
          title: i18n.global.t('appPageTitle.factoryReset'),
        },
      },
      {
        path: '/settings/power-restore-policy',
        name: 'power-restore-policy',
        component: PowerRestorePolicy,
        meta: {
          title: i18n.global.t('appPageTitle.powerRestorePolicy'),
        },
      },
      {
        path: '/resource-management/power',
        name: 'power',
        component: Power,
        meta: {
          title: i18n.global.t('appPageTitle.power'),
        },
      },
      {
        path: '/resource-management/memory',
        name: 'memory',
        component: Memory,
        meta: {
          title: i18n.global.t('appPageTitle.memory'),
        },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'page-not-found',
        component: PageNotFound,
        meta: {
          title: i18n.global.t('appPageTitle.pageNotFound'),
        },
      },
    ],
  },
];

export default routes;
