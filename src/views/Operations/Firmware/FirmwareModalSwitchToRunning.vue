<template>
  <b-modal
    id="modal-switch-to-running"
    v-model="modal"
    :ok-title="$t('pageFirmware.modal.switchImages')"
    :cancel-title="$t('global.action.cancel')"
    :title="$t('pageFirmware.modal.switchRunningImage')"
  >
    <p>
      {{ $t('pageFirmware.modal.switchRunningImageInfo') }}
    </p>
    <p class="m-0">
      {{
        $t('pageFirmware.modal.switchRunningImageInfo2', {
          backup,
        })
      }}
    </p>
  </b-modal>
</template>

<script setup>
import { ref } from 'vue';
import eventBus from '@/eventBus';

defineProps({
  backup: {
    type: String,
    required: true,
  },
});

const modal = ref(false);

eventBus.on('modal-switch-to-running', () => {
  modal.value = true;
});
</script>
