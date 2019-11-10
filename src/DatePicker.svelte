<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";

  import DatePanel from "./DatePanel.svelte";

  const dispatch = createEventDispatcher();

  const display = d => {
    let year = `${d.getFullYear()}`;
    let month = `${d.getMonth() + 1}`.padStart(2, "0");
    let date = `${d.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${date}`;
  };

  let width = "300px";
  let zindex = "1200";
  let canShowPanel = false;
  let selectedDate = new Date();

  const startShowPanel = e => {
    canShowPanel = true;
  };

  const closePanel = () => (canShowPanel = false);

  const selectDate = e => {
    selectedDate = e.detail;

    dispatch("change", selectedDate);
    closePanel();
  };

  // 处理 click outside
  let container;
  const clickOutsideHandler = e => {
    if (!container.contains(e.target)) {
      closePanel();
    }
  };

  onMount(() => {
    document.addEventListener("click", clickOutsideHandler);
  });

  onDestroy(() => {
    document.removeEventListener("click", clickOutsideHandler);
  });
</script>

<div bind:this={container} style="width: auto; position: relative;">
  <input readonly value={display(selectedDate)} on:focus={startShowPanel} />
  {#if canShowPanel}
    <div transition:fade={{ delay: 0, duration: 200 }}>
      <DatePanel
        {width}
        {zindex}
        on:change={selectDate}
        initialValue={selectedDate} />
    </div>
  {/if}
</div>
