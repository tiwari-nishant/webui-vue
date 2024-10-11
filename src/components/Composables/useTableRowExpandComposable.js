import i18n from '@/i18n';
const useTableRowExpandComposable = () => {
  let expandRowLabel = i18n.global.t('global.table.expandTableRow');
  const toggleRowDetails = (row) => {
    row.toggleDetails();
    expandRowLabel = row.detailsShowing
      ? i18n.global.t('global.table.collapseTableRow')
      : i18n.global.t('global.table.expandTableRow');
  };
  const toggleRow = (row) => {
    row.item.toggleDetails = !row.item.toggleDetails;
    toggleRowDetails(row);
  };
  return {
    expandRowLabel,
    toggleRowDetails,
    toggleRow,
  };
};

export default useTableRowExpandComposable;
