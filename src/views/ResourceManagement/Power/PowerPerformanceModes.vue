<template>
  <div>
    <page-section :section-title="$t('pagePower.powerPerformanceModesTitle')">
      <b-row class="mb-3">
        <b-col md="9" xl="8">
          <alert v-if="oemMode" variant="info" class="mb-4">
            <p class="mb-0">
              <b>{{ $t('pagePower.oemMode.message1') }} </b
              >{{ $t('pagePower.oemMode.message2') }}
            </p></alert
          >
        </b-col>
        <b-col xl="10">
          <b-button v-b-toggle.collapse-role-table variant="link">
            <icon-chevron />
            {{ $t('pagePower.powerPerformanceModesDropdownLabel') }}
          </b-button>
          <b-collapse id="collapse-role-table" class="mt-3">
            <table-power-performance-modes
              :power-performance-mode-values="powerPerformanceModeValues"
            />
          </b-collapse>
        </b-col>
      </b-row>
      <b-row>
        <b-col>
          <b-form
            id="form-power-saver"
            @submit.prevent="handlePowerPerformanceSubmit"
          >
            <b-form-group :disabled="loading || safeMode">
              <b-row>
                <b-col>
                  <b-form-group :label="$t('pagePower.selectModeLabel')">
                    <b-form-radio
                      v-model="powerPerformanceMode"
                      value="MaximumPerformance"
                      @change="setPowerPerformanceValue('MaximumPerformance')"
                      >{{
                        $t('pagePower.selectMode.maximumPerformance.primary')
                      }}
                      <info-tooltip
                        :title="
                          $t(
                            'pagePower.selectMode.maximumPerformance.secondary'
                          )
                        "
                      />
                    </b-form-radio>
                    <b-form-radio
                      v-model="powerPerformanceMode"
                      value="EfficiencyFavorPower"
                      @change="setPowerPerformanceValue('EfficiencyFavorPower')"
                      >{{ $t('pagePower.selectMode.energyEfficient.primary') }}
                      <info-tooltip
                        :title="
                          $t('pagePower.selectMode.energyEfficient.secondary')
                        "
                    /></b-form-radio>
                    <b-form-radio
                      v-model="powerPerformanceMode"
                      value="PowerSaving"
                      @change="setPowerPerformanceValue('PowerSaving')"
                      >{{
                        $t('pagePower.selectMode.maximumEnergySaver.primary')
                      }}
                      <info-tooltip
                        :title="
                          $t(
                            'pagePower.selectMode.maximumEnergySaver.secondary'
                          )
                        "
                    /></b-form-radio>
                  </b-form-group>
                </b-col>
              </b-row>
              <b-button
                :disabled="powerPerformanceMode === 'OEM'"
                variant="primary"
                type="submit"
                form="form-power-saver"
              >
                {{ $t('pagePower.submitButton') }}
              </b-button>
            </b-form-group>
          </b-form>
        </b-col>
      </b-row>

      <modal-power-performance-modes
        :title="powerPerformanceMode"
        @ok="savePowerPerformanceMode"
      />
    </page-section>
  </div>
</template>

<script>
import PageSection from '@/components/Global/PageSection';
import LoadingBarMixin, { loading } from '@/components/Mixins/LoadingBarMixin';
import BVToastMixin from '@/components/Mixins/BVToastMixin';
import IconChevron from '@carbon/icons-vue/es/chevron--up/20';
import ModalPowerPerformanceModes from './ModalPowerPerformanceModes';
import TablePowerPerformanceModes from './TablePowerPerformanceModes';
import InfoTooltip from '@/components/Global/InfoTooltip';
import Alert from '@/components/Global/Alert';

export default {
  components: {
    PageSection,
    IconChevron,
    ModalPowerPerformanceModes,
    TablePowerPerformanceModes,
    InfoTooltip,
    Alert,
  },
  mixins: [BVToastMixin, LoadingBarMixin],
  beforeRouteLeave(to, from, next) {
    this.hideLoader();
    next();
  },
  props: {
    safeMode: {
      type: Boolean,
      default: null,
    },
  },
  data() {
    return {
      loading,
      powerPerformanceMode: null,
      powerPerformanceModeOptions: [
        { text: this.$t('pagePower.selectMode.static'), value: 'Static' },
        {
          text: this.$t('pagePower.selectMode.powerSaving'),
          value: 'PowerSaving',
        },
        {
          text: this.$t('pagePower.selectMode.maximumPerformance'),
          value: 'MaximumPerformance',
        },
      ],
    };
  },
  computed: {
    powerPerformanceModeData() {
      return this.$store.getters['powerControl/powerPerformanceMode'];
    },
    powerPerformanceModeValues() {
      return this.$store.getters['powerControl/powerPerformanceModeValues'];
    },
    oemMode() {
      return this.$store.getters['powerControl/oemMode'];
    },
  },
  created() {
    this.startLoader();
    this.$store.dispatch('powerControl/getPowerPerformanceMode').finally(() => {
      this.setPowerPerformanceValue(this.powerPerformanceModeData);
      this.endLoader();
    });
  },
  methods: {
    setPowerPerformanceValue(data) {
      this.powerPerformanceMode = data;
    },
    handlePowerPerformanceSubmit() {
      if (this.powerPerformanceMode) {
        this.showConfirmationModal();
      }
    },
    showConfirmationModal() {
      this.$bvModal.show('modal-power-performance-modes');
    },
    savePowerPerformanceMode() {
      this.startLoader();
      this.$store
        .dispatch(
          'powerControl/setPowerPerformanceMode',
          this.powerPerformanceMode
        )
        .then((message) => {
          this.successToast(message);
          this.$store.commit(
            'powerControl/setPowerPerformanceMode',
            this.powerPerformanceMode
          );
        })
        .then(() => this.$store.dispatch('powerControl/getIdlePowerSaverData'))
        .catch(({ message }) => {
          this.errorToast(message);
          this.$store
            .dispatch('powerControl/getPowerPerformanceMode')
            .then(() =>
              this.setPowerPerformanceValue(this.powerPerformanceModeData)
            );
        })
        .finally(() => this.endLoader());
    },
  },
};
</script>

<style lang="scss" scoped>
.btn.collapsed {
  svg {
    transform: rotate(180deg);
  }
}
</style>
