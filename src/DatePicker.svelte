<script>
  import DatePanel from "./DatePanel.svelte";

  function display(d) {
    return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(
      2,
      "0"
    )}-${`${d.getDate()}`.padStart(2, "0")}`;
  }

  let width = "300px";
  let canShowPanel = false;
  let selectedDate = new Date();

  let startShowPanel = e => {
    canShowPanel = true;
  };

  let closePanel = () => (canShowPanel = false);

  let selectDate = e => {
    selectedDate = e.detail;
    closePanel();
  };
</script>

<div>
  <input readonly value={display(selectedDate)} on:focus={startShowPanel} />
  {#if canShowPanel}
    <DatePanel {width} on:change={selectDate} />
  {/if}
</div>
