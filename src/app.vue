<template>
  <div>
    <div class="row">
      <div class="cell">{{displays.firstDate.getFullYear()}}-{{displays.firstDate.getMonth() + 1}}</div>
    </div>
    <div class="row">
      <div v-for="weekday in displays.weekdays" :key="weekday" class="cell label">
        <label>{{weekday}}</label>
      </div>
    </div>
    <div class="row" v-for="(row, index) in displays.dataTable" :key="index">
      <div v-for="(item) in row" :key="+item" class="cell label">
        <a href="javascript:" @click="selectDate(item)">{{display(item)}}</a>
      </div>
    </div>
  </div>
</template>

<script>
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_DAYS_COUNT = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const addDate = (d, count) => {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + count,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  );
};
const getFirstDate = () => {
  let d = new Date();
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    1,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  );
};

export default {
  data() {
    return {
      displays: {
        dataTable: [],
        firstDate: getFirstDate(),
        weekdays: WEEKDAYS
      }
    };
  },
  mounted() {
    this.displays.firstDate = getFirstDate();
    this.updateDataTable(this.displays.firstDate);
  },
  methods: {
    display(d) {
      return d.getDate();
    },
    selectDate(d) {
      let firstDateOfThatMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      this.displays.firstDate = firstDateOfThatMonth;
      this.updateDataTable(this.displays.firstDate);

      this.$emit("change", d);
    },
    updateDataTable(today = null) {
      let currentWeekdayIndex = today.getDay() == 0 ? 6 : today.getDay() - 1;
      let start = currentWeekdayIndex !== 0 ? 0 - currentWeekdayIndex : 0;

      let result = [];
      for (let i = 0; i < 42; i++) {
        result[i] = addDate(today, start + i);
      }

      let table = [];
      for (let i = 0; i < 6; i++) {
        let items = result.slice(i * 7, i * 7 + 7);
        table.push(items);
      }

      this.$set(this.displays, "dataTable", table);
    }
  }
};
</script>

<style>
.row {
  display: flex;
}
.cell {
  flex: initial;
}
.cell-auto {
  flex: 1;
}

.label {
  width: 2rem;
  line-height: 2;
  border: #c9c9c9 solid 1px;
  text-align: center;
}
</style>