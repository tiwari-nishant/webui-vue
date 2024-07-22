import { defineStore } from 'pinia';
import api from '@/store/api';
import i18n from '@/i18n';

export const KeyClearStore = defineStore('keyclear', {
  actions: {
    async clearEncryptionKeys(selectedKey) {
      const selectedKeyForClearing = {
        Attributes: { hb_key_clear_request: selectedKey },
      };
      return await api
        .patch(
          '/redfish/v1/Systems/system/Bios/Settings',
          selectedKeyForClearing,
        )
        .then(() =>
          i18n.global.t('pageKeyClear.toast.selectedKeyClearedSuccess'),
        )
        .catch((error) => {
          console.log('Key clear', error);
          throw new Error(
            i18n.global.t('pageKeyClear.toast.selectedKeyClearedError'),
          );
        });
    },
  },
});

export default KeyClearStore;
