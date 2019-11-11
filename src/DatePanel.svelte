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

  const eqDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

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
  export let zindex = "1200";

  let selectedDate = initialValue;
  let dispatch = createEventDispatcher();

  let firstDate = getFirstDateOfMonth(selectedDate);
  let datesTable = createDatesTable(firstDate);

  const selectDate = d => {
    selectedDate = d;
    dispatch("change", d);
  };

  const nextMonth = factor => {
    selectedDate = addMonth(selectedDate, factor);
    datesTable = createDatesTable(getFirstDateOfMonth(selectedDate));
  };
</script>

<style>
  .panel {
    position: absolute;
    left: 0;
    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
  }

  .row {
    display: flex;
  }

  .row-between {
    justify-content: space-between;
  }

  .cell {
    flex: 1;
  }

  .cell-initial {
    flex: initial;
  }

  .label {
    line-height: 2;
    text-align: center;
  }

  .current {
    background-color: rgba(0, 140, 255, 0.315);
  }
</style>

<div style="width: {width}; z-index: {zindex}" class="panel">
  <div class="row row-between">
    <div class="cell label">
      <a href="javascript:" on:click|preventDefault={() => nextMonth(-12)}>⇤</a>
    </div>
    <div class="cell label">
      <a href="javascript:" on:click|preventDefault={() => nextMonth(-1)}>←</a>
    </div>
    <div class="cell-initial label">{selectedDate.getFullYear()}&nbsp;年</div>
    <div class="cell-initial label">&nbsp;{selectedDate.getMonth() + 1}&nbsp;月</div>
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
        <div
          class="cell label"
          class:current={eqDate(date, selectedDate)}>
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
