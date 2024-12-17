<template>
  <b-table stacked="sm" hover :items="items" :fields="fields"> </b-table>
</template>

<script>
export default {
  components: {},
  data() {
    return {
      fields: [
        {
          key: 'setting',
          label: this.$t('pagePower.tableRoles.setting'),
          sortable: false,
        },
        {
          key: 'description',
          label: this.$t('pagePower.tableRoles.description'),
          sortable: false,
        },
      ],
      items: [
        {
          setting: this.$t('pagePower.selectMode.maximumPerformance.primary'),
          description: this.$t('pagePower.tableRoles.descMaximumPerformance'),
        },
        {
          setting: this.$t('pagePower.selectMode.energyEfficient.primary'),
          description: this.$t('pagePower.tableRoles.descEnergyEfficient'),
        },
        {
          setting: this.$t('pagePower.selectMode.maximumEnergySaver.primary'),
          description: this.$t('pagePower.tableRoles.descMaximumEnergySaver'),
        },
      ],
    };
  },
};
</script>
