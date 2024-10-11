import api, { getResponseCount } from '@/store/api';
import i18n from '@/i18n';
import { defineStore } from 'pinia';

export const SessionsStore = defineStore('sessions', {
  state: () => ({
    allConnections: [],
  }),
  getters: {
    allConnectionsGetter: (state) => state.allConnections,
  },
  actions: {
    async getSessionsData() {
      return await api
        .get('/redfish/v1/SessionService/Sessions')
        .then((response) =>
          response.data.Members.map((sessionLogs) => sessionLogs['@odata.id']),
        )
        .then((sessionUris) =>
          api.all(sessionUris.map((sessionUri) => api.get(sessionUri))),
        )
        .then((sessionUris) => {
          const allConnectionsData = sessionUris.map((sessionUri) => {
            //For filtering IP address to IPv4
            let filteredIPAddress =
              sessionUri.data?.ClientOriginIPAddress.split('::ffff:').pop();
            return {
              isSelected: false,
              clientID: sessionUri.data?.Context,
              username: sessionUri.data?.UserName,
              ipAddress: filteredIPAddress,
              uri: sessionUri.data['@odata.id'],
            };
          });
          this.allConnections = allConnectionsData;
        })
        .catch((error) => {
          console.log('Client Session Data:', error);
        });
    },
    async disconnectSessions(uris) {
      const promises = uris.map((uri) =>
        api.delete(uri).catch((error) => {
          console.log(error);
          return error;
        }),
      );
      return await api
        .all(promises)
        .then((response) => {
          this.getSessionsData();
          return response;
        })
        .then(
          api.spread((...responses) => {
            const { successCount, errorCount } = getResponseCount(responses);
            const toastMessages = [];

            if (successCount) {
              const message = i18n.global.t(
                'pageSessions.toast.successDelete',
                successCount,
              );
              toastMessages.push({ type: 'success', message });
            }

            if (errorCount) {
              const message = i18n.global.t(
                'pageSessions.toast.errorDelete',
                errorCount,
              );
              toastMessages.push({ type: 'error', message });
            }
            return toastMessages;
          }),
        );
    },
  },
});
export default SessionsStore;
