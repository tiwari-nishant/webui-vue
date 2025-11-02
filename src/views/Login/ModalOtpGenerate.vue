<template>
  <b-modal
    id="modal-otp-generate"
    v-model="modal"
    size="lg"
    :title="$t('pageLogin.modal.register')"
    title-tag="h2"
    scrollable
    centered
    no-close-on-esc
    hide-header-close
    no-close-on-backdrop
    @ok="okFormSubmit"
    @cancel="resetForm"
    @hidden="resetForm"
  >
    <b-row>
      <b-col>
        <b-row>
          <qrcode-vue
            v-if="qrValue"
            class="qrcode-styling"
            :value="qrValue"
            :size="size"
            level="H"
            render-as="canvas"
          />
          <div v-else class="emptyQrStyle"></div>
        </b-row>
        <b-row>
          <b-col>
            <b-button
              v-b-toggle.collapse-2
              class="m-1 buttonStyle"
              data-test-id="modal-secret-key"
            >
              <icon-chevron />
              {{ $t('pageUserManagement.modal.secretKey') }}</b-button
            >
            <b-collapse id="collapse-2" data-test-id="modal-secret-key-value">
              {{ dataFormatter(secretKey) }}
            </b-collapse>
          </b-col>
          <b-col class="m-1">
            <b-button @click="copySecretKey">
              <template v-if="secretKeyCopied">
                <icon-checkmark title="Copied" />
              </template>
              <template v-else>
                <icon-copy title="Copy Secret key" />
              </template>
            </b-button>
          </b-col>
        </b-row>
      </b-col>
      <b-col>
        <b-form
          id="otp-generate-form"
          style="margin-top: 45px"
          novalidate
          @submit.prevent
        >
          <b-container fluid="xl">
            <div class="login-form__section mb-3">
              <alert variant="info" class="mb-4">
                <dt>{{ $t('pageUserManagement.modal.helptext') }}:</dt>
                <dd>
                  {{ $t('pageUserManagement.modal.helptextStep1') }}
                </dd>
                <dd>
                  {{ $t('pageUserManagement.modal.helptextStep2') }}
                </dd>
              </alert>
            </div>
            <div class="login-form__section mb-3">
              <label>{{ $t('pageUserManagement.modal.otp') }}</label>
              <b-form-group>
                <b-form-input
                  v-model="otpValue"
                  :state="getValidationState(v$.otpValue)"
                  data-test-id="modal-totp-value"
                  @input="v$.otpValue.$touch()"
                />
                <b-form-invalid-feedback role="alert">
                  <template v-if="!v$.otpValue.required">
                    {{ $t('global.form.fieldRequired') }}
                  </template>
                </b-form-invalid-feedback>
              </b-form-group>
            </div>
          </b-container>
        </b-form>
      </b-col>
    </b-row>
    <template #modal-footer="{ ok, cancel }">
      <b-button variant="secondary" size="sm" @click="cancel()">
        {{ $t('pageServerPowerOperations.modal.networkSettings.cancel') }}
      </b-button>
      <b-button
        form="otp-generate-form"
        type="submit"
        variant="primary"
        size="sm"
        @click="ok()"
      >
        {{ $t('pageLogin.modal.login') }}
      </b-button>
    </template>
  </b-modal>
</template>
<script setup>
import { required } from '@vuelidate/validators';
import { ref, computed, watch, nextTick } from 'vue';
import Alert from '@/components/Global/Alert.vue';
import IconCopy from '@carbon/icons-vue/es/copy/16';
import IconCheckmark from '@carbon/icons-vue/es/checkmark/16';
import QrcodeVue from 'qrcode.vue';
import IconChevron from '@carbon/icons-vue/es/chevron--up/20';
import UserManagementStore from '../../store/modules/SecurityAndAccess/UserManagementStore';
import GlobalStore from '../../store/modules/GlobalStore';
import AuthenticationStore from '../../store/modules/Authentication/AuthenticationStore';
import { useRouter } from 'vue-router';
import useVuelidateComposable from '@/components/Composables/useVuelidateComposable';
import useDataFormatterGlobal from '../../components/Composables/useDataFormatterGlobal';
import useToast from '@/components/Composables/useToastComposable';
import useVuelidate from '@vuelidate/core';
import eventBus from '@/eventBus';

const modal = ref(false);
const issuer = ref('bmc');
const router = useRouter();
const { dataFormatter } = useDataFormatterGlobal();
const accountName = ref(localStorage.getItem('storedUsername'));
const otpValue = ref(null);
const secretKeyCopied = ref(false);
const qrValue = ref(null);
const size = ref(350);
const { errorToast } = useToast();

const globalStore = GlobalStore();
const userManagementStore = UserManagementStore();
const authenticationStore = AuthenticationStore();

const { getValidationState } = useVuelidateComposable();
const secretKey = computed(() => {
  return userManagementStore.secretKeyInfoGetter;
});

const rules = computed(() => ({
  otpValue: modal.value
    ? {
        required,
      }
    : {},
}));

const v$ = useVuelidate(rules, { otpValue });

eventBus.on('otp-generate-modal', () => {
  modal.value = true;
});

watch(secretKey, (newValue) => {
  if (newValue === null) {
    qrValue.value = null;
  } else {
    qrValue.value = `otpauth://totp/${issuer.value}:${accountName.value}?secret=${newValue}&issuer=${issuer.value}`;
  }
});

function copySecretKey() {
  navigator.clipboard.writeText(secretKey.value).then(() => {
    // Show copied text for 5 seconds
    secretKeyCopied.value = true;
    setTimeout(() => {
      secretKeyCopied.value = false;
    }, 5000 /*5 seconds*/);
  });
}

function okFormSubmit(event) {
  event.preventDefault();
  handleSubmit();
}

function resetForm() {
  otpValue.value = null;
  v$.value.$reset();
}

function handleSubmit() {
  v$.value.$touch();
  if (v$.value.$invalid) return;
  userManagementStore
    .verifyRegisterTotp({ otpValue: otpValue.value })
    .then(() => {
      const username = localStorage.getItem('storedUsername');
      Promise.all([
        globalStore.getCurrentUser(username),
        globalStore.getSystemInfo(),
      ])
        .then(() => {
          closeModal();
          router.push('/');
        })
        .catch(() => {
          closeModal();
          Promise.all([
            authenticationStore.unauthlogin(),
            authenticationStore.logout(),
          ]);
        });
    })
    .catch(({ message }) => errorToast(message));
}
function closeModal() {
  nextTick(() => {
    modal.value = false;
  });
}
</script>
<style lang="scss" scoped>
.qrcode-styling {
  margin-left: 15px;
  max-width: 350px;
}
.row {
  margin-left: 0px;
  margin-right: 0px;
}
.emptyQrStyle {
  width: 350px;
  height: 350px;
}
.buttonStyle {
  margin-left: 0px !important;
  width: auto;
}
.btn {
  svg {
    margin-right: 11px;
  }
}
.btn.collapsed {
  svg {
    transform: rotate(180deg);
  }
}
</style>
