import { ref } from 'vue';
const useSearchFilterComposable = () => {
  let searchFilterInput = ref('');
  const onChangeSearch = (searchValue) => {
    searchFilterInput.value = searchValue;
    return;
  };
  const onClearSearch = () => {
    searchFilterInput.value = '';
    return;
  };
  return {
    searchFilterInput,
    onChangeSearch,
    onClearSearch,
  };
};

export default useSearchFilterComposable;
