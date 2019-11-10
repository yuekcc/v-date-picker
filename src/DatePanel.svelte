<script>
  import { createEventDispatcher } from "svelte";

  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

  const addDate = (d, factor) => {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + factor,
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    );
  };

  const addMonth = (d, factor) => {
    return new Date(
      d.getFullYear(),
      d.getMonth() + factor,
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    );
  };

  const getFirstDateOfMonth = d => {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      1,
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    );
  };

  const createDatesTable = firstDateOfMonth => {
    let weekdayIndex =
      firstDateOfMonth.getDay() === 0 ? 6 : firstDateOfMonth.getDay() - 1;
    let factorBase = weekdayIndex === 0 ? 0 : 0 - weekdayIndex;

    let dates = [];
    for (let i = 0; i < 42; i++) {
      dates[i] = addDate(firstDateOfMonth, factorBase + i);
    }

    let table = [];
    for (let i = 0; i < 6; i++) {
      table.push(dates.slice(i * 7, i * 7 + 7));
    }

    return table;
  };

  export let initialValue = new Date();
  export let width = "300px";

  let value = initialValue;
  let dispatch = createEventDispatcher();

  $: firstDate = getFirstDateOfMonth(value);
  $: datesTable = createDatesTable(firstDate);

  $: selectDate = d => {
    console.log(JSON.stringify(d));
    value = d;
    dispatch("change", d);
  };

  $: nextMonth = factor => {
    value = addMonth(value, factor);
  };
</script>

<style>
  .row {
    display: flex;
  }

  .row-between {
    justify-content: space-between;
  }

  .cell {
    flex: 1;
  }

  .label {
    line-height: 2;
    border: #c9c9c9 solid 1px;
    text-align: center;
  }
</style>

<div style="width: {width}">
  <div class="row row-between">
    <div class="cell label">
      <a href="javascript:" on:click|preventDefault={() => nextMonth(-12)}>⇤</a>
    </div>
    <div class="cell label">
      <a href="javascript:" on:click|preventDefault={() => nextMonth(-1)}>←</a>
    </div>
    <div class="cell label">{value.getFullYear()}</div>
    <div class="cell label">{value.getMonth() + 1}</div>
    <div class="cell label">
      <a href="javascript:" on:click|preventDefault={() => nextMonth(1)}>→</a>
    </div>
    <div class="cell label">
      <a href="javascript:" on:click|preventDefault={() => nextMonth(12)}>⇥</a>
    </div>
  </div>
  <div class="row">
    {#each WEEKDAYS as item}
      <div class="cell label">{item}</div>
    {/each}
  </div>
  {#each datesTable as row}
    <div class="row">
      {#each row as date}
        <div class="cell label">
          <a
            href="javascript:"
            on:click|preventDefault={() => selectDate(date)}>
            {date.getDate()}
          </a>
        </div>
      {/each}
    </div>
  {/each}
</div>
