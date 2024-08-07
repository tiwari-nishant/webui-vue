<template>
  <b-container fluid="xl">
    <page-title :title="$t('appPageTitle.firmware')" />
    <alerts-server-power
      v-if="isServerPowerOffRequired"
      :is-server-off="isServerOff"
    />

    <!-- Firmware cards -->
    <b-row>
      <b-col xl="10">
        <!-- BMC Firmware -->
        <bmc-cards
          :is-page-disabled="isPageDisabled"
          :is-server-off="isServerOff"
          @loadingStatus="loadingStatus"
        />

        <!-- Host Firmware -->
        <host-cards v-if="!isSingleFileUploadEnabled" />
      </b-col>
    </b-row>

    <!-- Update firmware-->
    <page-section :section-title="$t('pageFirmware.sectionTitleUpdateFirmware')"
      ><b-row>
        <b-col sm="14" md="10" xl="6">
          <alert :show="showAlert" variant="info" class="mb-5">
            <p class="mb-0 p1">{{ $t('global.toast.minMifMessage') }}:</p>
            <p class="font-weight-bold p2">
              {{ lowestSupportedFirmwareVersion }}
            </p>
          </alert>
        </b-col>
      </b-row>
      <b-row>
        <b-col class="mb-4" sm="8" md="6" xl="4">
          <!-- Update form -->
          <form-update
            :is-page-disabled="isPageDisabled"
            @loadingStatus="loadingStatus"
          />
        </b-col>
        <b-col sm="8" md="6" xl="4">
          <!-- Access key expiration -->
          <firmware-access-key :is-page-disabled="isPageDisabled" />
        </b-col>
      </b-row>
    </page-section>
  </b-container>
</template>

<script>
import AlertsServerPower from './FirmwareAlertServerPower';
import BmcCards from './FirmwareCardsBmc';
import FirmwareAccessKey from './FirmwareAccessKey';
import FormUpdate from './FirmwareFormUpdate';
import HostCards from './FirmwareCardsHost';
import PageSection from '@/components/Global/PageSection';
import PageTitle from '@/components/Global/PageTitle';
import Alert from '@/components/Global/Alert';

import LoadingBarMixin, { loading } from '@/components/Mixins/LoadingBarMixin';

export default {
  name: 'FirmwareSingleImage',
  components: {
    AlertsServerPower,
    BmcCards,
    FirmwareAccessKey,
    FormUpdate,
    HostCards,
    PageSection,
    PageTitle,
    Alert,
  },
  mixins: [LoadingBarMixin],
  beforeRouteLeave(to, from, next) {
    this.hideLoader();
    next();
  },
  data() {
    return {
      loading,
      isServerPowerOffRequired:
        process.env.VUE_APP_SERVER_OFF_REQUIRED === 'true',
      lowestSupportedFirmwareVersion: '',
      showAlert: false,
    };
  },
  computed: {
    serverStatus() {
      return this.$store.getters['global/serverStatus'];
    },
    isServerOff() {
      return this.serverStatus === 'off' ? true : false;
    },
    isSingleFileUploadEnabled() {
      return this.$store.getters['firmware/isSingleFileUploadEnabled'];
    },
    isPageDisabled() {
      if (this.isServerPowerOffRequired) {
        return !this.isServerOff || this.loading || this.isOperationInProgress;
      }
      return this.loading || this.isOperationInProgress;
    },
  },
  created() {
    this.startLoader();
    Promise.all([
      this.$store.dispatch('licenses/getLicenses'),
      this.$store.dispatch('firmware/getFirmwareInformation'),
      this.$store.dispatch('firmware/getFirmwareBootSide'),
      this.$store
        .dispatch('firmware/getLowestSupportedFirmwareVersion')
        .then(() => {
          this.lowestSupportedFirmwareVersion = this.$store.getters[
            'firmware/lowestSupportedFirmwareVersion'
          ];
        }),
      this.$store
        .dispatch('firmware/getLowestSupportedFirmwareVersion')
        .then(() => {
          this.showAlert = this.$store.getters['firmware/showAlert'];
        }),
    ]).finally(() => this.endLoader());
  },
  methods: {
    loadingStatus(loading) {
      this.loading = loading;
    },
  },
};
</script>
<style scoped>
.p1 {
  display: inline-block;
}
.p2 {
  margin-left: 5px;
  display: inline-block;
}
</style>
