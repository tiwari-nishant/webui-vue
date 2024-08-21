import api from '@/store/api';
import i18n from '@/i18n';
import { defineStore } from 'pinia';

export const ConcurrentMaintenanceStore = defineStore('concurrentMaintenance', {
  state: () => ({
    readyToRemove: null,
    todObject: {},
    readyToRemoveControlPanel: null,
    controlPanel: {},
    readyToRemoveControlPanelDisp: null,
    controlPanelDisp: {},
  }),
  getters: {
    ReadyToRemoveGetter: (state) => state.readyToRemove,
    todObjectGetter: (state) => state.todObject,
    ReadyToRemoveControlPanelGetter: (state) => state.readyToRemoveControlPanel,
    controlPanelGetter: (state) => state.controlPanel,
    ReadyToRemoveControlPanelDispGetter: (state) =>
      state.readyToRemoveControlPanelDisp,
    controlPanelDispGetter: (state) => state.controlPanelDisp,
  },
  actions: {
    async fetchReadyToRemove() {
      return await api
        .get('/redfish/v1/Chassis/chassis/Assembly')
        .then((response) =>
          response.data.Assemblies.map((entry) => {
            if (
              Object.hasOwn(entry?.Oem?.OpenBMC || {}, 'ReadyToRemove') &&
              entry?.Location?.PartLocation?.ServiceLabel?.endsWith?.(
                'P0-C0-E0',
              )
            ) {
              this.todObject = entry;
              this.readyToRemove = entry.Oem.OpenBMC.ReadyToRemove;
            }
          }),
        )
        .catch((error) => console.log(error));
    },
    async fetchControlPanel() {
      return await api
        .get('/redfish/v1/Chassis/chassis/Assembly')
        .then((response) =>
          response.data.Assemblies.map((entry) => {
            if (
              Object.hasOwn(entry?.Oem?.OpenBMC || {}, 'ReadyToRemove') &&
              entry?.Location?.PartLocation?.ServiceLabel?.endsWith?.('D0')
            ) {
              this.controlPanel = entry;
              this.readyToRemoveControlPanel = entry.Oem.OpenBMC.ReadyToRemove;
            }
          }),
        )
        .catch((error) => console.log(error));
    },
    async fetchControlPanelDisp() {
      return await api
        .get('/redfish/v1/Chassis/chassis/Assembly')
        .then((response) =>
          response.data.Assemblies.map((entry) => {
            if (
              Object.hasOwn(entry?.Oem?.OpenBMC || {}, 'ReadyToRemove') &&
              entry?.Location?.PartLocation?.ServiceLabel?.endsWith?.('D1')
            ) {
              this.controlPanelDisp = entry;
              this.readyToRemoveControlPanelDisp =
                entry.Oem.OpenBMC.ReadyToRemove;
            }
          }),
        )
        .catch((error) => console.log(error));
    },
    async saveReadyToRemoveState(updatedReadyToRemove) {
      this.ReadyToRemove = updatedReadyToRemove;
      return await api
        .patch('/redfish/v1/Chassis/chassis/Assembly', {
          Assemblies: [
            {
              MemberId: this.todObject.MemberId,
              Oem: {
                OpenBMC: {
                  ReadyToRemove: updatedReadyToRemove,
                },
              },
            },
          ],
        })
        .then(() => {
          return i18n.global.t(
            'pageConcurrentMaintenance.toast.successSaveReadyToRemove',
            {
              state: updatedReadyToRemove ? 'enabled' : 'disabled',
            },
          );
        })
        .catch((error) => {
          console.log(error);
          this.readyToRemove = !updatedReadyToRemove;
          throw new Error(
            i18n.global.t(
              'pageConcurrentMaintenance.toast.errorSaveReadyToRemove',
              {
                state: updatedReadyToRemove ? 'enabling' : 'disabling',
              },
            ),
          );
        });
    },
    async saveReadyToRemoveControlPanel(updatedControlPanel) {
      this.readyToRemoveControlPanel = updatedControlPanel;
      return await api
        .patch('/redfish/v1/Chassis/chassis/Assembly', {
          Assemblies: [
            {
              MemberId: this.controlPanel.MemberId,
              Oem: {
                OpenBMC: {
                  ReadyToRemove: updatedControlPanel,
                },
              },
            },
          ],
        })
        .then(() => {
          return i18n.global.t(
            'pageConcurrentMaintenance.toast.successSaveReadyToRemove',
            {
              state: updatedControlPanel ? 'enabled' : 'disabled',
            },
          );
        })
        .catch((error) => {
          console.log(error);
          this.readyToRemoveControlPanel = !updatedControlPanel;
          throw new Error(
            i18n.global.t(
              'pageConcurrentMaintenance.toast.errorSaveReadyToRemove',
              {
                controlPanel: updatedControlPanel ? 'enabling' : 'disabling',
              },
            ),
          );
        });
    },
    async saveReadyToRemoveControlPanelDisp(updatedControlPanelDisp) {
      this.readyToRemoveControlPanelDisp = updatedControlPanelDisp;
      return await api
        .patch('/redfish/v1/Chassis/chassis/Assembly', {
          Assemblies: [
            {
              MemberId: this.controlPanelDisp.MemberId,
              Oem: {
                OpenBMC: {
                  ReadyToRemove: updatedControlPanelDisp,
                },
              },
            },
          ],
        })
        .then(() => {
          return i18n.global.t(
            'pageConcurrentMaintenance.toast.successSaveReadyToRemove',
            {
              state: updatedControlPanelDisp ? 'enabled' : 'disabled',
            },
          );
        })
        .catch((error) => {
          console.log(error);
          this.readyToRemoveControlPanelDisp = !updatedControlPanelDisp;
          throw new Error(
            i18n.global.t(
              'pageConcurrentMaintenance.toast.errorSaveReadyToRemove',
              {
                controlPanelDisp: updatedControlPanelDisp
                  ? 'enabling'
                  : 'disabling',
              },
            ),
          );
        });
    },
  },
});
export default ConcurrentMaintenanceStore;
