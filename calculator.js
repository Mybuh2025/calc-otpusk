// --- УПРОЩЕННЫЕ ДАННЫЕ ПРОИЗВОДСТВЕННОГО КАЛЕНДАРЯ (ПРИМЕР НА 2025) ---
 // В реальном приложении эти данные должны быть точными, актуальными и загружаться из надежного источника
 const productionCalendarData = {
  2025: {
  holidays: ["2025-01-01", "2025-01-02", "2025-01-07", "2025-03-08", "2025-03-21", "2025-03-22", "2025-03-23", /* Наурыз */
  "2025-03-31", /* Курбан айт (пример, дата плавающая) */
  "2025-05-01", "2025-05-07", "2025-05-09", "2025-07-06", "2025-08-30", "2025-10-25", "2025-12-16"], // Добавьте все + переносы
  workDaysBalance: { // Примерные средние значения для простоты
  "5day": { 1: 19, 2: 20, 3: 19, 4: 22, 5: 19, 6: 21, 7: 22, 8: 21, 9: 22, 10: 22, 11: 20, 12: 21 },
  "6day": { 1: 23, 2: 24, 3: 24, 4: 26, 5: 24, 6: 25, 7: 27, 8: 26, 9: 26, 10: 27, 11: 25, 12: 25 }
  }
  // Нужны также данные по часам для суммированного учета и среднемесячные показатели
  }
 };

 function isHoliday(dateStr) {
  const year = new Date(dateStr).getFullYear();
  if (productionCalendarData[year]) {
  return productionCalendarData[year].holidays.includes(dateStr);
  }
  return false;
 }

 function isWeekend(date, workSchedule) {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (workSchedule === '5day') {
  return dayOfWeek === 0 || dayOfWeek === 6;
  } else if (workSchedule === '6day') {
  return dayOfWeek === 0;
  }
  return false;
 }

 // --- Основные Функции Расчета (согласно методологии) ---

 /**
 * Определяет расчетный период (12 мес до события или фактический)
 * @param {Date} eventDate - Дата начала отпуска или дата увольнения
 * @param {Date} hireDate - Дата приема на работу
 * @returns {{startDate: Date, endDate: Date}}
 */
 function determineCalculationPeriod(eventDate, hireDate) {
  let endDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), 0); // Конец предыдущего месяца
  let startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth() + 1, 1); // Начало - 12 мес назад

  if (hireDate > startDate) {
  startDate = new Date(hireDate);
  // Корректировка endDate, если период меньше месяца? (По методологии - фактически отработанный)
  // Для прототипа оставляем конец предыдущего месяца
  }
  return { startDate, endDate };
 }

 /**
 * Рассчитывает Средний Дневной Заработок (СДЗ)
 * @param {Array<Object>} monthlyIncomes - [{ monthYear: 'YYYY-MM', income: number }]
 * @param {string} workSchedule - '5day' или '6day'
 * @param {Object} increaseDetails - { date: Date, oldSalary: number, newSalary: number }
 * @param {{startDate: Date, endDate: Date}} calculationPeriod
 * @param {Date} hireDate
 * @returns {{avgDailyWage: number, totalAdjustedIncome: number, totalWorkingDays: number, details: string[]}}
 */
 function calculateAverageSalary(monthlyIncomes, workSchedule, increaseDetails, calculationPeriod, hireDate) {
  let totalAdjustedIncome = 0;
  let totalWorkingDays = 0;
  const details = [];
  let monthsProcessed = 0;

  // Коэффициент повышения [cite: 33]
  let increaseCoefficient = 1;
  let increaseDate = null;
  if (increaseDetails && increaseDetails.date && increaseDetails.oldSalary > 0 && increaseDetails.newSalary > increaseDetails.oldSalary) {
  increaseDate = new Date(increaseDetails.date);
  increaseCoefficient = increaseDetails.newSalary / increaseDetails.oldSalary;
  details.push(`Применен коэффициент повышения ${increaseCoefficient.toFixed(4)} с ${increaseDate.toLocaleDateString()}`);
  } else {
  details.push("Коэффициент повышения не применялся.");
  }

  // Обработка доходов за расчетный период [cite: 26, 35]
  const currentPeriodDate = new Date(calculationPeriod.startDate);
  const endPeriodDate = new Date(calculationPeriod.endDate);

  while (currentPeriodDate <= endPeriodDate) {
  const year = currentPeriodDate.getFullYear();
  const month = currentPeriodDate.getMonth(); // 0-11
  const monthYearStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const incomeData = monthlyIncomes.find(inc => inc.monthYear === monthYearStr);
  const monthlyEligibleIncome = incomeData ? incomeData.income : 0; // Учитываемый доход [cite: 27]

  // Определение рабочих дней в месяце [cite: 36]
  let workingDaysInMonth = 0;
  if (productionCalendarData[year] && productionCalendarData[year].workDaysBalance[workSchedule]) {
      // Упрощенно берем из баланса. Реально нужно считать по дням, учитывая hireDate и endDate периода
      workingDaysInMonth = productionCalendarData[year].workDaysBalance[workSchedule][month + 1] || 0;

      // Корректировка для первого и последнего месяца периода (если неполные) - УПРОЩЕНО
      if (currentPeriodDate.getFullYear() === calculationPeriod.startDate.getFullYear() &&
          currentPeriodDate.getMonth() === calculationPeriod.startDate.getMonth()) {
         // Логика корректировки дней для неполного первого месяца
      }
       if (currentPeriodDate.getFullYear() === calculationPeriod.endDate.getFullYear() &&
          currentPeriodDate.getMonth() === calculationPeriod.endDate.getMonth()) {
           // Логика корректировки дней для неполного последнего месяца
       }

  } else {
      details.push(`(!) Отсутствуют данные баланса раб. времени для ${monthYearStr}`);
  }


  // Применение коэффициента повышения [cite: 33, 97]
  let adjustedIncome = monthlyEligibleIncome;
  const firstDayOfMonth = new Date(year, month, 1);
  if (increaseDate && firstDayOfMonth < increaseDate && monthlyEligibleIncome > 0) {
  adjustedIncome *= increaseCoefficient;
  details.push(`Месяц ${monthYearStr}: Доход ${monthlyEligibleIncome} * ${increaseCoefficient.toFixed(4)} = ${adjustedIncome.toFixed(2)}`);
  } else if (monthlyEligibleIncome > 0) {
      details.push(`Месяц ${monthYearStr}: Доход ${monthlyEligibleIncome}`);
  }


  // Исключаемые периоды (больничные и т.д.) - НЕ РЕАЛИЗОВАНО В ПРОТОТИПЕ [cite: 25, 75]
  // Здесь нужно вычитать дни/часы и доход из excludedPeriods


  totalAdjustedIncome += adjustedIncome;
  totalWorkingDays += workingDaysInMonth;
  monthsProcessed++;


  // Переход к следующему месяцу
  currentPeriodDate.setMonth(currentPeriodDate.getMonth() + 1);
  }

  // Проверка, если стаж < 12 месяцев [cite: 25]
  const monthsInPeriod = (calculationPeriod.endDate.getFullYear() - calculationPeriod.startDate.getFullYear()) * 12 +
                         (calculationPeriod.endDate.getMonth() - calculationPeriod.startDate.getMonth()) + 1;

  if (monthsProcessed === 0 || totalWorkingDays <= 0) {
      details.push("Ошибка: Нет данных о доходе или рабочих днях в расчетном периоде.");
      return { avgDailyWage: 0, totalAdjustedIncome: 0, totalWorkingDays: 0, details };
  }


  const avgDailyWage = totalAdjustedIncome / totalWorkingDays; // [cite: 39]
  details.push(`Расчетный период: ${calculationPeriod.startDate.toLocaleDateString()} - ${calculationPeriod.endDate.toLocaleDateString()}`);
  details.push(`Общий скорректированный доход: ${totalAdjustedIncome.toFixed(2)}`);
  details.push(`Всего рабочих дней в периоде (${workSchedule}): ${totalWorkingDays}`);
  details.push(`Средний дневной заработок (СДЗ): ${avgDailyWage.toFixed(2)}`);

  return { avgDailyWage, totalAdjustedIncome, totalWorkingDays, details };
 }


 /**
 * Считает рабочие дни в периоде отпуска/компенсации
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} workSchedule
 * @returns {{payableWorkingDays: number, calendarDays: number, holidaysCount: number, details: string[]}}
 */
 function getWorkingDaysHoursInPeriod(startDate, endDate, workSchedule) {
  let payableWorkingDays = 0;
  let calendarDays = 0;
  let holidaysCount = 0;
  const details = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
  calendarDays++;
  const dateStr = currentDate.toISOString().split('T')[0];

  if (isHoliday(dateStr)) {
  holidaysCount++;
  details.push(`${dateStr}: Праздничный день (не оплачивается, не учитывается в раб. днях)`); // [cite: 41, 43]
  } else if (!isWeekend(currentDate, workSchedule)) {
  payableWorkingDays++;
  details.push(`${dateStr}: Рабочий день (оплачивается)`);
  } else {
       details.push(`${dateStr}: Выходной день (${workSchedule === '5day' ? 'СБ/ВС' : 'ВС'}) (не учитывается в раб. днях для оплаты)`); // Оплачивается через СДЗ, но сам день не рабочий
  }

  currentDate.setDate(currentDate.getDate() + 1);
  }
   details.push(`Итого календарных дней в периоде: ${calendarDays}`);
   details.push(`Из них праздничных дней: ${holidaysCount}`);
   details.push(`Итого ОПЛАЧИВАЕМЫХ РАБОЧИХ ДНЕЙ (${workSchedule}) в периоде: ${payableWorkingDays}`); // [cite: 42, 47]


  return { payableWorkingDays, calendarDays, holidaysCount, details };
 }


 // --- Функции для вызова из HTML ---

 function setupForm() {
  const calcTypeSelect = document.getElementById('calculationType');
  const vacationFields = document.getElementById('vacationFields');
  const compensationFields = document.getElementById('compensationFields');
  const monthlyIncomeDiv = document.getElementById('monthlyIncomeDetails');
  const hireDateInput = document.getElementById('employeeHireDate');
  const resultsDiv = document.getElementById('results');


  function toggleFields() {
  resultsDiv.style.display = 'none'; // Скрыть результаты при изменении
  if (calcTypeSelect.value === 'vacation') {
  vacationFields.style.display = 'block';
  compensationFields.style.display = 'none';
  } else {
  vacationFields.style.display = 'none';
  compensationFields.style.display = 'block';
  }
  // Динамическое добавление полей дохода при изменении типа или даты найма
  updateIncomeFields();
  }


  function updateIncomeFields() {
     monthlyIncomeDiv.innerHTML = ''; // Очистить старые поля
     const eventDateElement = calcTypeSelect.value === 'vacation'
                             ? document.getElementById('vacationStartDate')
                             : document.getElementById('terminationDate');
     let eventDate = eventDateElement.value ? new Date(eventDateElement.value) : new Date();
     if (isNaN(eventDate)) eventDate = new Date();


      const hireDate = hireDateInput.value ? new Date(hireDateInput.value) : null;
      if (!hireDate || isNaN(hireDate)) {
          monthlyIncomeDiv.innerHTML = '<p><i>Укажите дату приема на работу</i></p>';
          return;
      }


      const period = determineCalculationPeriod(eventDate, hireDate);
      let currentMonth = new Date(period.endDate);


      for (let i = 0; i < 12; i++) {
          if (currentMonth < period.startDate && period.startDate >= hireDate) break; // Условие остановки для короткого стажа


          const year = currentMonth.getFullYear();
          const month = currentMonth.getMonth(); // 0-11
          const monthYearStr = `${year}-${String(month + 1).padStart(2, '0')}`;


          const monthDiv = document.createElement('div');
          monthDiv.classList.add('income-month');


          const label = document.createElement('label');
          label.setAttribute('for', `income_${monthYearStr}`);
          label.textContent = `${monthYearStr}:`;


          const input = document.createElement('input');
          input.type = 'number';
          input.id = `income_${monthYearStr}`;
          input.name = `income_${monthYearStr}`;
          input.step = '0.01';
          input.placeholder = 'Учитываемый доход';
          input.dataset.monthYear = monthYearStr; // Сохраняем YYYY-MM


          monthDiv.appendChild(label);
          monthDiv.appendChild(input);
          monthlyIncomeDiv.prepend(monthDiv); // Добавляем в начало, чтобы были по порядку


          // Переход к предыдущему месяцу
          currentMonth.setMonth(currentMonth.getMonth() - 1);
       }
  }


  calcTypeSelect.addEventListener('change', toggleFields);
  // Обновлять поля дохода при изменении дат
  document.getElementById('vacationStartDate').addEventListener('change', updateIncomeFields);
  document.getElementById('terminationDate').addEventListener('change', updateIncomeFields);
  hireDateInput.addEventListener('change', updateIncomeFields);


  // Инициализация
  toggleFields();
 }


 function calculate() {
  const form = document.getElementById('calculatorForm');
  const resultsDiv = document.getElementById('results');
  const outputPre = document.getElementById('output');
  outputPre.textContent = ''; // Clear previous results
  resultsDiv.style.display = 'none';

  // Сбор данных из формы
  const calculationType = form.calculationType.value;
  const workSchedule = form.workSchedule.value;
  const hireDate = new Date(form.employeeHireDate.value);

  if (isNaN(hireDate)) {
      alert("Пожалуйста, укажите корректную дату приема на работу.");
      return;
  }

  // Сбор доходов
  const monthlyIncomes = [];
  const incomeInputs = form.querySelectorAll('#monthlyIncomeDetails input[type="number"]');
  incomeInputs.forEach(input => {
      if (input.dataset.monthYear && parseFloat(input.value) >= 0) {
          monthlyIncomes.push({
              monthYear: input.dataset.monthYear,
              income: parseFloat(input.value) || 0
          });
      }
  });

  if (monthlyIncomes.length === 0) {
       alert("Пожалуйста, введите доходы хотя бы за один месяц расчетного периода.");
       return;
   }


  // Сбор данных о повышении (упрощено)
  const increaseDateRaw = form.salaryIncreaseDate.value;
  const increaseDetails = {
  date: increaseDateRaw ? new Date(increaseDateRaw) : null,
  oldSalary: parseFloat(form.oldSalary.value) || 0,
  newSalary: parseFloat(form.newSalary.value) || 0
  };

  // Исключаемые периоды - НЕ РЕАЛИЗОВАНО
  const excludedPeriods = [];

  let finalResult = {};
  let calculationDetails = [];

  try {
  if (calculationType === 'vacation') {
  const vacationStartDate = new Date(form.vacationStartDate.value);
  const vacationEndDate = new Date(form.vacationEndDate.value);
  if (isNaN(vacationStartDate) || isNaN(vacationEndDate) || vacationEndDate < vacationStartDate) {
  alert("Пожалуйста, укажите корректные даты начала и окончания отпуска.");
  return;
  }

  const period = determineCalculationPeriod(vacationStartDate, hireDate);
  const avgSalaryResult = calculateAverageSalary(monthlyIncomes, workSchedule, increaseDetails, period, hireDate);
  calculationDetails.push("--- Расчет Среднего Дневного Заработка ---");
  calculationDetails.push(...avgSalaryResult.details);


  if (avgSalaryResult.avgDailyWage > 0) {
        calculationDetails.push("\n--- Расчет Оплачиваемых Дней Отпуска ---");
        const payableDaysResult = getWorkingDaysHoursInPeriod(vacationStartDate, vacationEndDate, workSchedule);
        calculationDetails.push(...payableDaysResult.details);


        const grossVacationPay = avgSalaryResult.avgDailyWage * payableDaysResult.payableWorkingDays; // [cite: 51]


        finalResult = {
            "Тип расчета": "Отпускные",
            "Период отпуска": `${vacationStartDate.toLocaleDateString()} - ${vacationEndDate.toLocaleDateString()}`,
            "Расчетный период СДЗ": `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`,
            "График работы": workSchedule,
            "Средний дневной заработок (СДЗ)": avgSalaryResult.avgDailyWage.toFixed(2),
            "Общий доход для СДЗ": avgSalaryResult.totalAdjustedIncome.toFixed(2),
            "Рабочих дней для СДЗ": avgSalaryResult.totalWorkingDays,
            "Календ. дней отпуска (в заданном диапазоне)": payableDaysResult.calendarDays,
            "Праздничных дней в периоде": payableDaysResult.holidaysCount,
            "Оплачиваемых РАБОЧИХ дней отпуска": payableDaysResult.payableWorkingDays,
            "Сумма отпускных (брутто)": grossVacationPay.toFixed(2) + " KZT" // [cite: 86]
        };
  } else {
       finalResult = {"Ошибка": "Не удалось рассчитать СДЗ."};
   }


  } else if (calculationType === 'compensation') {
  const terminationDate = new Date(form.terminationDate.value);
  const unusedVacationDays = parseInt(form.unusedVacationDays.value, 10);
  if (isNaN(terminationDate)) {
  alert("Пожалуйста, укажите корректную дату увольнения.");
  return;
  }
   if (isNaN(unusedVacationDays) || unusedVacationDays < 0) {
        alert("Пожалуйста, укажите корректное количество неиспользованных дней отпуска (0 или больше).");
        return;
    }


  const period = determineCalculationPeriod(terminationDate, hireDate);
  const avgSalaryResult = calculateAverageSalary(monthlyIncomes, workSchedule, increaseDetails, period, hireDate);
  calculationDetails.push("--- Расчет Среднего Дневного Заработка ---");
  calculationDetails.push(...avgSalaryResult.details);


  if (avgSalaryResult.avgDailyWage > 0 && unusedVacationDays > 0) {
        // Определение рабочих дней для компенсации [cite: 61]
        // Отсчет со следующего РАБОЧЕГО дня после увольнения
        let firstDayAfterTermination = new Date(terminationDate);
        firstDayAfterTermination.setDate(firstDayAfterTermination.getDate() + 1);
        while(isHoliday(firstDayAfterTermination.toISOString().split('T')[0]) || isWeekend(firstDayAfterTermination, workSchedule)) {
             firstDayAfterTermination.setDate(firstDayAfterTermination.getDate() + 1);
        }


        // Имитация подсчета рабочих дней для N календарных дней отпуска - УПРОЩЕНО
        // В реальном коде нужен точный подсчет по календарю
        let compensationPayableWorkingDays = 0;
        let tempDate = new Date(firstDayAfterTermination);
        let calendarDaysCounted = 0;
        let compensationPeriodEndDate = new Date(firstDayAfterTermination); // Для отображения периода


         calculationDetails.push(`\n--- Расчет Рабочих Дней для Компенсации (${unusedVacationDays} календ. дней) ---`);
         calculationDetails.push(`Отсчет с первого раб. дня после увольнения: ${firstDayAfterTermination.toLocaleDateString()}`);


         while (calendarDaysCounted < unusedVacationDays) {
             const dateStr = tempDate.toISOString().split('T')[0];
              if (!isHoliday(dateStr)) { // Пропускаем только праздники для календарных дней
                   calendarDaysCounted++;
                   compensationPeriodEndDate = new Date(tempDate); // Запоминаем последний день
                   if (!isWeekend(tempDate, workSchedule)) {
                      compensationPayableWorkingDays++;
                      calculationDetails.push(`${dateStr}: Рабочий день (учитывается для оплаты)`);
                   } else {
                       calculationDetails.push(`${dateStr}: Выходной день (не добавляет раб. день, но входит в календ.)`);
                   }
              } else {
                 calculationDetails.push(`${dateStr}: Праздничный день (пропускается)`);
              }
              tempDate.setDate(tempDate.getDate() + 1);
          }


         calculationDetails.push(`Итого РАБОЧИХ дней для оплаты компенсации: ${compensationPayableWorkingDays}`);


        const grossCompensationAmount = avgSalaryResult.avgDailyWage * compensationPayableWorkingDays; // [cite: 63]


        finalResult = {
            "Тип расчета": "Компенсация при увольнении",
            "Дата увольнения": terminationDate.toLocaleDateString(),
            "Неиспользовано дней отпуска (календ.)": unusedVacationDays,
            "Расчетный период СДЗ": `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`,
            "График работы": workSchedule,
            "Средний дневной заработок (СДЗ)": avgSalaryResult.avgDailyWage.toFixed(2),
            "Период, за который начисляются раб. дни компенсации (примерно)": `${firstDayAfterTermination.toLocaleDateString()} - ${compensationPeriodEndDate.toLocaleDateString()}`,
            "Рабочих дней для оплаты компенсации": compensationPayableWorkingDays,
            "Сумма компенсации (брутто)": grossCompensationAmount.toFixed(2) + " KZT" // [cite: 86]
        };
  } else if (unusedVacationDays === 0) {
      finalResult = {
          "Тип расчета": "Компенсация при увольнении",
           "Дата увольнения": terminationDate.toLocaleDateString(),
           "Неиспользовано дней отпуска (календ.)": 0,
           "Сумма компенсации (брутто)": "0.00 KZT"
       };
   } else {
       finalResult = {"Ошибка": "Не удалось рассчитать СДЗ."};
   }
  }
  } catch (error) {
      console.error("Ошибка расчета:", error);
      finalResult = { "Ошибка": "Произошла ошибка во время расчета. См. консоль." };
       calculationDetails.push(`ОШИБКА: ${error.message}`);
  }


  // Отображение результатов
  outputPre.textContent = `Основные Результаты:\n${JSON.stringify(finalResult, null, 2)}\n\nДетали Расчета:\n${calculationDetails.join('\n')}`;
  resultsDiv.style.display = 'block';
 }

 // Инициализация формы при загрузке страницы
 document.addEventListener('DOMContentLoaded', setupForm);