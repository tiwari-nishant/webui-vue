import api from '@/store/api';
import i18n from '@/i18n';
import { defineStore } from 'pinia';

export const BmcStore = defineStore('bmc', {
  state: () => ({
    bmc: null,
  }),
  getters: {
    bmcGetter: (state) => state.bmc,
  },
  actions: {
    setBmcInfo(data) {
      const bmc = {};
      bmc.dateTime = new Date(data.DateTime);
      bmc.description = data.Description;
      bmc.health = data.Status.Health;
      bmc.id = data.Id;
      bmc.identifyLed = data.LocationIndicatorActive;
      bmc.locationNumber = data.Location?.PartLocation?.ServiceLabel;
      bmc.model = data.Model;
      bmc.name = data.Name;
      bmc.partNumber = data.PartNumber;
      bmc.powerState = data.PowerState;
      bmc.serialNumber = data.SerialNumber;
      bmc.sparePartNumber = data.SparePartNumber;
      bmc.statusState = data.Status.State;
      bmc.uri = data['@odata.id'];
      this.bmc = bmc;
    },
    async getBmcInfo() {
      return await api
        .get('/redfish/v1/Managers/bmc')
        .then(({ data }) => this.setBmcInfo(data))
        .catch((error) => console.log(error));
    },
    async updateIdentifyLedValue(led) {
      const uri = led.uri;
      const updatedIdentifyLedValue = {
        LocationIndicatorActive: led.identifyLed,
      };
      return await api
        .patch(uri, updatedIdentifyLedValue)
        .then(() => {
          this.getBmcInfo();
          if (led.identifyLed) {
            return i18n.global.t(
              'pageInventory.toast.successEnableIdentifyLed',
            );
          } else {
            return i18n.global.t(
              'pageInventory.toast.successDisableIdentifyLed',
            );
          }
        })
        .catch((error) => {
          this.getBmcInfo();
          console.log('error', error);
          if (led.identifyLed) {
            throw new Error(
              i18n.global.t('pageInventory.toast.errorEnableIdentifyLed'),
            );
          } else {
            throw new Error(
              i18n.global.t('pageInventory.toast.errorDisableIdentifyLed'),
            );
          }
        });
    },
  },
});

export default BmcStore;
