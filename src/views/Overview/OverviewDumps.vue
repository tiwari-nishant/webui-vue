<template>
  <overview-card
    :data="dumps"
    :file-name="exportFileNameByDate()"
    :title="$t('pageOverview.dumps')"
    :to="`/logs/dumps`"
  >
    <BRow class="mt-3">
      <BCol sm="6">
        <dl>
          <dt>{{ $t('pageOverview.total') }}</dt>
          <dd class="h3">{{ dataFormatter(dumps.length) }}</dd>
        </dl>
      </BCol>
    </BRow>
  </overview-card>
</template>

<script setup>
import { computed, watch } from 'vue';
import OverviewCard from './OverviewCard.vue';
import useDataFormatterGlobal from '@/components/Composables/useDataFormatterGlobal';
import { useDumps } from '@/api/composables/useDumps';
import eventBus from '@/eventBus';

const { dataFormatter } = useDataFormatterGlobal();

// Use the new vue-query composable
const { allDumps: dumpsData, isLoading } = useDumps();

// Watch for loading completion
watch(
  isLoading,
  (loading) => {
    if (!loading) {
      eventBus.emit('overview-dumps-complete');
    }
  },
  { immediate: true },
);

const dumps = computed(() => {
  return dumpsData.value || [];
});

const exportFileNameByDate = () => {
  // Create export file name based on date
  let date = new Date();
  date =
    date.toISOString().slice(0, 10) +
    '_' +
    date.toString().split(':').join('-').split(' ')[4];
  let fileName = 'all_dumps_';
  return fileName + date;
};
</script>
