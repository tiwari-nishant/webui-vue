import api from '@/store/api';
import i18n from '@/i18n';
import { defineStore } from 'pinia';

const parseData = (data) => {
  const [resourceId = '--', sequenceNumber = '--'] =
    data?.SerialNumber?.split('-') || '';
  const expirationDate = data?.ExpirationDate
    ? new Date(data.ExpirationDate)
    : '--';
  const licensed = data?.LicenseScope?.MaxNumberOfDevices || '--';

  return {
    licensed,
    resourceId,
    sequenceNumber,
    expirationDate,
  };
};

export const LicenseStore = defineStore('license', {
  state: () => ({
    licenses: {},
  }),
  getters: {
    licensesGetter: (state) => state.licenses,
    vetCapabilities: (state) =>
      Object.values(state.licenses).filter((license) => {
        return (
          license.Name !== 'AIX Update Access Key' &&
          license.Name !== 'Asset Protection Machine ID' &&
          license.Name !== 'Asset Protection Public Key' &&
          license.Name !== 'Elastic MemoryGB*Days Available' &&
          license.Name !== 'Elastic Processor*Days Available' &&
          license.Name !== 'Trial Memory Licenses (GB)' &&
          license.Name !== 'Permanent Memory Licenses (GB)' &&
          license.Name !== 'Permanent Processor Licenses' &&
          license.Name !== 'Firmware Update Access Key' &&
          license.Name !== 'Virtualization Engine Technology' &&
          license.Name !== 'Trial Processor Licenses' &&
          license.Name !== 'System Anchor'
        );
      }),
    processorInfo: (state) => parseData(state.licenses.PermProcs),
    memoryInfo: (state) => parseData(state.licenses.PermMem),
    firmwareAccessKeyInfo: (state) => parseData(state.licenses.UAK),
    aixAccessKeyInfo: (state) => parseData(state.licenses.AIXUAK),
  },
  actions: {
    async getLicenses() {
      return await api
        .get('/redfish/v1/LicenseService/Licenses')
        .then(({ data: { Members = [] } }) => {
          return Members.map((member) => api.get(member['@odata.id']));
        })
        .then((promises) => api.all(promises))
        .then((response) => {
          const data = response.reduce((acc, { data }) => {
            acc[data.Id] = data;
            return acc;
          }, {});
          this.licenses = data;
        })
        .catch((error) => {
          console.log('Licenses', error);
        });
    },
    async activateLicense(licenseKey) {
      return await api
        .post('/redfish/v1/LicenseService/Licenses', {
          LicenseString: licenseKey,
        })
        .then(() => {
          return i18n.global.t('pageCapacityOnDemand.activation.toast.success');
        })
        .catch((error) => {
          console.log('Licenses', error);
          throw new Error(
            i18n.global.t('pageCapacityOnDemand.activation.toast.error'),
          );
        });
    },
  },
});

export default LicenseStore;
