import api from '@/store/api';
import i18n from '@/i18n';

const PowerControlStore = {
  namespaced: true,
  state: {
    powerConsumption: null,
    powerControlMode: null,
    powerCap: null,
    powerCapMin: null,
    powerCapMax: null,
    powerPerformanceMode: null,
    powerPerformanceModeValues: null,
    idlePowerSaverData: null,
  },
  getters: {
    powerConsumption: (state) => state.powerConsumption,
    powerControlMode: (state) => state.powerControlMode,
    isPowerCapEnabled: (state) => state.powerControlMode === 'Automatic',
    powerCap: (state) => state.powerCap,
    powerCapMin: (state) => state.powerCapMin,
    powerCapMax: (state) => state.powerCapMax,
    powerPerformanceMode: (state) => state.powerPerformanceMode,
    powerPerformanceModeValues: (state) => state.powerPerformanceModeValues,
    idlePowerSaverData: (state) => state.idlePowerSaverData,
    oemMode: (state) => state.powerPerformanceMode === 'OEM',
  },
  mutations: {
    setPowerConsumption: (state, powerConsumptionValue) =>
      (state.powerConsumption = powerConsumptionValue),
    setPowerControlMode: (state, powerControlModeValue) =>
      (state.powerControlMode = powerControlModeValue),
    setPowerCap: (state, powerCapValue) => (state.powerCap = powerCapValue),
    setPowerCapMin: (state, powerCapMinValue) =>
      (state.powerCapMin = powerCapMinValue),
    setPowerCapMax: (state, powerCapMaxValue) =>
      (state.powerCapMax = powerCapMaxValue),
    setPowerPerformanceMode: (state, powerPerformanceMode) =>
      (state.powerPerformanceMode = powerPerformanceMode),
    setPowerPerformanceModeValues: (state, powerPerformanceModeValues) =>
      (state.powerPerformanceModeValues = powerPerformanceModeValues),
    setIdlePowerSaverData: (state, idlePowerSaverData) =>
      (state.idlePowerSaverData = idlePowerSaverData),
  },
  actions: {
    async getPowerControl({ commit }) {
      return await api
        .get('/redfish/v1/Chassis/chassis/EnvironmentMetrics')
        .then(({ data }) => {
          commit('setPowerConsumption', data.PowerWatts?.Reading);
          commit('setPowerControlMode', data.PowerLimitWatts?.ControlMode);
          commit('setPowerCap', data.PowerLimitWatts?.SetPoint);
          commit('setPowerCapMin', data.PowerLimitWatts?.AllowableMin);
          commit('setPowerCapMax', data.PowerLimitWatts?.AllowableMax);
        })
        .catch((error) => {
          console.log(error);
        });
    },
    async setPowerControlAndCap(_, { powerControlMode, powerCap }) {
      const newPowerCap = {
        PowerLimitWatts: {
          ControlMode: powerControlMode,
          SetPoint: powerCap,
        },
      };

      return await api
        .patch('/redfish/v1/Chassis/chassis/EnvironmentMetrics', newPowerCap)
        .then(() =>
          i18n.t('pageServerPowerOperations.toast.successSaveSettings')
        )
        .catch((error) => {
          console.log(error);
          throw new Error(
            i18n.t('pageServerPowerOperations.toast.errorSaveSettings')
          );
        });
    },
    async getPowerPerformanceMode({ commit }) {
      return await api
        .get('/redfish/v1/Systems/system')
        .then(({ data }) => {
          commit('setPowerPerformanceMode', data.PowerMode);
          commit(
            'setPowerPerformanceModeValues',
            data['PowerMode@Redfish.AllowableValues']
          );
        })
        .catch((error) => {
          console.log(error);
        });
    },
    async setPowerPerformanceMode(_, powerPerformanceMode) {
      const newData = { PowerMode: powerPerformanceMode };
      return await api
        .patch('/redfish/v1/Systems/system', newData)
        .then(() => i18n.t('pagePower.toast.successPowerPerformanceModes'))
        .catch((error) => {
          console.log(error);
          throw new Error(i18n.t('pagePower.toast.errorPowerPerformanceModes'));
        });
    },
    async getIdlePowerSaverData({ commit }) {
      return await api
        .get('/redfish/v1/Systems/system')
        .then(({ data }) => {
          const idlePowerSaverData = data.IdlePowerSaver;
          commit('setIdlePowerSaverData', idlePowerSaverData);
        })
        .catch((error) => {
          console.log(error);
        });
    },
    async setIdlePowerSaverData(_, idlePowerSaverData) {
      const newData = {
        IdlePowerSaver: {
          Enabled: idlePowerSaverData.isIdlePowerSaverEnabled,
          EnterDwellTimeSeconds: idlePowerSaverData.enterDwellTimeSeconds,
          ExitDwellTimeSeconds: idlePowerSaverData.exitDwellTimeSeconds,
          EnterUtilizationPercent: idlePowerSaverData.enterUtilizationPercent,
          ExitUtilizationPercent: idlePowerSaverData.exitUtilizationPercent,
        },
      };
      return await api
        .patch('/redfish/v1/Systems/system', newData)
        .then(() => i18n.t('pagePower.toast.successIdlePower'))
        .catch((error) => {
          console.log(error);
          throw new Error(i18n.t('pagePower.toast.errorIdlePower'));
        });
    },
    async resetIdlePowerSaver() {
      const newData = {
        IdlePowerSaver: {
          ExitUtilizationPercent: 0,
        },
      };
      return await api
        .patch('/redfish/v1/Systems/system', newData)
        .then(() => i18n.t('pagePower.toast.successIdlePowerReset'))
        .catch((error) => {
          console.log(error);
          throw new Error(i18n.t('pagePower.toast.errorIdlePowerReset'));
        });
    },
    async setIdlePowerSaverEnable(_, idlePowerSaver) {
      const newData = {
        IdlePowerSaver: {
          Enabled: idlePowerSaver,
        },
      };
      return await api
        .patch('/redfish/v1/Systems/system', newData)
        .then(() => i18n.t('pagePower.toast.successPowerPerformanceModes'))
        .catch((error) => {
          console.log(error);
          throw new Error(i18n.t('pagePower.toast.errorPowerPerformanceModes'));
        });
    },
  },
};

export default PowerControlStore;
