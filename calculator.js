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
  const year = parseInt(dateStr.substring(0, 4), 10);
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
 * @returns {{startDate: Date | null, endDate: Date | null}}
 */
 function determineCalculationPeriod(eventDate, hireDate) {
    if (isNaN(eventDate.getTime()) || isNaN(hireDate.getTime())) {
         console.error("Invalid date passed to determineCalculationPeriod");
         return { startDate: null, endDate: null };
     }


     let endDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), 0); // Конец предыдущего месяца
     let startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth() + 1, 1); // Начало - 12 мес назад


     // Корректируем начало периода датой найма, если она позже
     if (hireDate > startDate) {
        startDate = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1); // Начинаем с 1-го числа месяца найма
     }


      // Предотвращаем ситуацию, когда start date > end date (например, событие в месяц найма)
      if (startDate > endDate) {
          console.warn("Start date is after end date in calculation period.");
          return { startDate: null, endDate: null };
      }


     return { startDate, endDate };
 }

 /**
 * Рассчитывает Средний Дневной Заработок (СДЗ)
 * @param {Array<Object>} monthlyIncomes - [{ monthYear: 'YYYY-MM', income: number }]
 * @param {string} workSchedule - '5day' или '6day'
 * @param {Object | null} increaseDetails - { date: Date, oldSalary: number, newSalary: number } | null
 * @param {{startDate: Date | null, endDate: Date | null}} calculationPeriod
 * @returns {{avgDailyWage: number, totalAdjustedIncome: number, totalWorkingDays: number, details: string[]}}
 */
 function calculateAverageSalary(monthlyIncomes, workSchedule, increaseDetails, calculationPeriod) {
  let totalAdjustedIncome = 0.0;
  let totalWorkingDays = 0;
  const details = [];
  let monthsProcessed = 0;

   if (!calculationPeriod || !calculationPeriod.startDate || !calculationPeriod.endDate) {
       details.push("Ошибка: Невозможно определить расчетный период.");
       return { avgDailyWage: 0, totalAdjustedIncome: 0, totalWorkingDays: 0, details };
   }


  // Коэффициент повышения
  let increaseCoefficient = 1.0;
  let increaseDate = null;
   if (increaseDetails && increaseDetails.date && !isNaN(increaseDetails.date.getTime()) && increaseDetails.oldSalary > 0 && increaseDetails.newSalary > increaseDetails.oldSalary) {
       increaseDate = increaseDetails.date;
       increaseCoefficient = increaseDetails.newSalary / increaseDetails.oldSalary;
       details.push(`Применен коэффициент повышения ${increaseCoefficient.toFixed(4)} с ${increaseDate.toLocaleDateString()}`);
   } else {
       details.push("Коэффициент повышения не применялся.");
   }


  // Обработка доходов за расчетный период
  const currentPeriodDate = new Date(calculationPeriod.startDate);
  const endPeriodDate = new Date(calculationPeriod.endDate);


  while (currentPeriodDate <= endPeriodDate) {
      const year = currentPeriodDate.getFullYear();
      const month = currentPeriodDate.getMonth(); // 0-11
      const monthIndex = month + 1; // 1-12
      const monthYearStr = `<span class="math-inline">\{year\}\-</span>{String(monthIndex).padStart(2, '0')}`;


      const incomeData = monthlyIncomes.find(inc => inc.monthYear === monthYearStr);
      const monthlyEligibleIncome = incomeData ? incomeData.income : 0; // Учитываемый доход


      // Определение рабочих дней в месяце (УПРОЩЕННО)
      let workingDaysInMonth = 0;
      if (productionCalendarData[year] && productionCalendarData[year].workDaysBalance[workSchedule] && productionCalendarData[year].workDaysBalance[workSchedule][monthIndex]) {
          workingDaysInMonth = productionCalendarData[year].workDaysBalance[workSchedule][monthIndex];
          // Нужна корректировка для неполных месяцев (первый/последний)
      } else {
          details.push(`(!) Отсутствуют данные баланса раб. времени для ${monthYearStr}`);
      }


      // Применение коэффициента повышения
      let adjustedIncome = monthlyEligibleIncome;
      const firstDayOfMonth = new Date(year, month, 1);
      if (increaseDate && firstDayOfMonth < increaseDate && monthlyEligibleIncome > 0) {
          adjustedIncome *= increaseCoefficient;
          details.push(`Месяц ${monthYearStr}: Доход ${monthlyEligibleIncome.toFixed(2)} * ${increaseCoefficient.toFixed(4)} = ${adjustedIncome.toFixed(2)}`);
      } else if (monthlyEligibleIncome > 0) {
          details.push(`Месяц ${monthYearStr}: Доход ${monthlyEligibleIncome.toFixed(2)}`);
      }


      // Исключаемые периоды (больничные и т.д.) - НЕ РЕАЛИЗОВАНО


      totalAdjustedIncome += adjustedIncome;
      totalWorkingDays += workingDaysInMonth;
      monthsProcessed++;


      // Переход к следующему месяцу
      currentPeriodDate.setMonth(currentPeriodDate.getMonth() + 1);
  }


   if (monthsProcessed === 0) {
       details.push("Ошибка: Нет обработанных месяцев в расчетном периоде.");
       return { avgDailyWage: 0, totalAdjustedIncome: 0, totalWorkingDays: 0, details };
   }


  if (totalWorkingDays <= 0) {
       details.push("Ошибка: Количество рабочих дней в расчетном периоде равно нулю. Проверьте календарь и даты.");
       return { avgDailyWage: 0, totalAdjustedIncome: totalAdjustedIncome, totalWorkingDays: 0, details };
   }


  const avgDailyWage = totalAdjustedIncome / totalWorkingDays;
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


   if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
       details.push("Ошибка: Некорректные даты для подсчета рабочих дней.");
       return { payableWorkingDays: 0, calendarDays: 0, holidaysCount: 0, details };
   }


  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
      calendarDays++;
      const dateStr = currentDate.toISOString().split('T')[0];


      if (isHoliday(dateStr)) {
          holidaysCount++;
          details.push(`${currentDate.toLocaleDateString()}: Праздничный день (не оплачивается, не учитывается в раб. днях)`);
      } else if (!isWeekend(currentDate, workSchedule)) {
          payableWorkingDays++;
          details.push(`${currentDate.toLocaleDateString()}: Рабочий день (оплачивается)`);
      } else {
           details.push(`<span class="math-inline">\{currentDate\.toLocaleDateString\(\)\}\: Выходной день \(</span>{workSchedule === '5day' ? 'СБ/ВС' : 'ВС'}) (не учитывается в раб. днях для оплаты)`);
      }


      currentDate.setDate(currentDate.getDate() + 1);
  }
   details.push(`Итого календарных дней в периоде: ${calendarDays}`);
   details.push(`Из них праздничных дней: ${holidaysCount}`);
   details.push(`Итого ОПЛАЧИВАЕМЫХ РАБОЧИХ ДНЕЙ (${workSchedule}) в периоде: ${payableWorkingDays}`);


  return { payableWorkingDays, calendarDays, holidaysCount, details };
 }


 // --- Функции для вызова из HTML ---

 function setupForm() {
  const calcTypeSelect = document.getElementById('calculationType');
  const vacationFields = document.getElementById('vacationFields');
  const compensationFields = document.getElementById('compensationFields');


  function toggleFields() {
      const isVacation = calcTypeSelect.value === 'vacation';
      vacationFields.style.display = isVacation ? 'block' : 'none';
      compensationFields.style.display = isVacation ? 'none' : 'block';
      // Динамическое добавление полей дохода при изменении типа или даты найма
      updateIncomeFields();
  }


   // --- ИСПРАВЛЕННАЯ ФУНКЦИЯ (аналогично PHP) ---
  function updateIncomeFields() {
       const monthlyIncomeDiv = document.getElementById('monthlyIncomeDetails');
       const hireDateInput = document.getElementById('employeeHireDate');
       const calcTypeSelect = document.getElementById('calculationType');


       if (!monthlyIncomeDiv || !hireDateInput || !calcTypeSelect) return; // Защита


       monthlyIncomeDiv.innerHTML = ''; // Очистить старые поля
       const eventDateElement = calcTypeSelect.value === 'vacation'
                               ? document.getElementById('vacationStartDate')
                               : document.getElementById('terminationDate');
       let eventDateVal = eventDateElement ? eventDateElement.value : null;


        // Используем текущую дату как запасной вариант, если дата события не введена
        let eventDate = eventDateVal ? new Date(eventDateVal) : new Date();
        if (isNaN(eventDate.getTime())) {
             eventDate = new Date();
             console.warn("Невалидная дата события, используется текущая дата для определения периода.");
         }


       const hireDateVal = hireDateInput.value;
       if (!hireDateVal) {
           monthlyIncomeDiv.innerHTML = '<p><i>Укажите дату приема на работу</i></p>';
           return;
       }


        let hireDate;
        try {
             hireDate = new Date(hireDateVal);
             if (isNaN(hireDate.getTime())) throw new Error("Invalid date");
         } catch (e) {
              monthlyIncomeDiv.innerHTML = '<p><i>Неверная дата приема на работу</i></p>';
             return;
         }


       const period = determineCalculationPeriod(eventDate, hireDate);


        if (!period || !period.startDate || !period.endDate) {
            monthlyIncomeDiv.innerHTML = '<p><i>Расчетный период пуст или некорректен (проверьте даты).</i></p>';
            return;
        }


       let currentMonth = new Date(period.endDate);


       for (let i = 0; i < 12; i++) {
           if (currentMonth < period.startDate) break;


           const year = currentMonth.getFullYear();
           const month = currentMonth.getMonth(); // 0-11
           const monthYearStr = `<span class="math-inline">\{year\}\-</span>{String(month + 1).padStart(2, '0')}`;


           const monthDiv = document.createElement('div');
           monthDiv.classList.add('income-month');


           const label = document.createElement('label');
           label.setAttribute('for', `income_${monthYearStr}`);
           label.textContent = monthYearStr + ':'; // Используем простую конкатенацию


           const input = document.createElement('input');
           input.type = 'number';
           input.id = `income_${monthYearStr}`;
           input.name = `income_${monthYearStr}`; // В JS версии имя может быть проще
           input.step = '0.01';
           input.placeholder = 'Учитываемый доход';
           input.dataset.monthYear = monthYearStr; // Сохраняем YYYY-MM для сбора данных
            input.min = "0";


           monthDiv.appendChild(label);
           monthDiv.appendChild(input);
           monthlyIncomeDiv.prepend(monthDiv); // Добавляем в начало


           // Переход к предыдущему месяцу
           currentMonth.setMonth(currentMonth.getMonth() - 1);
       }
   }
    // --- КОНЕЦ ИСПРАВЛЕННОЙ ФУНКЦИИ ---


  calcTypeSelect.addEventListener('change', toggleFields);
  // Обновлять поля дохода при изменении дат
  document.getElementById('vacationStartDate').addEventListener('change', updateIncomeFields);
  document.getElementById('terminationDate').addEventListener('change', updateIncomeFields);
  document.getElementById('employeeHireDate').addEventListener('change', updateIncomeFields);


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
  const hireDateStr = form.employeeHireDate.value;
   let hireDate;


   try {
       if (!hireDateStr) throw new Error("Не указана дата приема на работу.");
       hireDate = new Date(hireDateStr);
       if (isNaN(hireDate.getTime())) throw new Error("Некорректная дата приема на работу.");
   } catch (error) {
       alert(error.message);
       return;
   }


  // Сбор доходов
  const monthlyIncomes = [];
  const incomeInputs = form.querySelectorAll('#monthlyIncomeDetails input[type="number"]');
  incomeInputs.forEach(input => {
      const incomeValue = parseFloat(input.value);
      if (input.dataset.monthYear && !isNaN(incomeValue) && incomeValue >= 0) {
          monthlyIncomes.push({
              monthYear: input.dataset.monthYear,
              income: incomeValue
          });
      } else if (input.dataset.monthYear && input.value !== '') {
           // Если введено что-то не числовое, но не пустое - считаем 0, но можно и предупредить
          console.warn(`Нечисловое значение дохода для ${input.dataset.monthYear}, используется 0.`);
           monthlyIncomes.push({ monthYear: input.dataset.monthYear, income: 0});
      }
  });

  if (monthlyIncomes.length === 0 && incomeInputs.length > 0) {
      console.warn("Поля для дохода есть, но не удалось собрать данные. Проверьте data-monthYear атрибуты.");
      // Не прерываем, но предупреждаем
  }


  // Сбор данных о повышении
  const increaseDateRaw = form.salaryIncreaseDate.value;
  let increaseDetails = null;
   if (increaseDateRaw && form.oldSalary.value && form.newSalary.value) {
       try {
           const increaseDate = new Date(increaseDateRaw);
           const oldSalary = parseFloat(form.oldSalary.value);
           const newSalary = parseFloat(form.newSalary.value);
           if (!isNaN(increaseDate.getTime()) && !isNaN(oldSalary) && !isNaN(newSalary) && oldSalary >= 0 && newSalary >= 0) {
                 increaseDetails = { date: increaseDate, oldSalary, newSalary };
             } else {
                  console.warn("Некорректные данные о повышении оклада.");
              }
       } catch (e) { console.warn("Ошибка парсинга данных о повышении.");}
   }


  // Исключаемые периоды - НЕ РЕАЛИЗОВАНО
  // const excludedPeriods = [];

  let finalResult = {};
  let calculationDetails = [];

  try {
      if (calculationType === 'vacation') {
          const vacationStartDateStr = form.vacationStartDate.value;
          const vacationEndDateStr = form.vacationEndDate.value;
           let vacationStartDate, vacationEndDate;


           if (!vacationStartDateStr || !vacationEndDateStr) throw new Error("Не указаны даты отпуска.");
           vacationStartDate = new Date(vacationStartDateStr);
           vacationEndDate = new Date(vacationEndDateStr);
           if (isNaN(vacationStartDate.getTime()) || isNaN(vacationEndDate.getTime())) throw new Error("Некорректные даты отпуска.");
           if (vacationEndDate < vacationStartDate) throw new Error("Дата окончания отпуска не может быть раньше даты начала.");


          const period = determineCalculationPeriod(vacationStartDate, hireDate);
          const avgSalaryResult = calculateAverageSalary(monthlyIncomes, workSchedule, increaseDetails, period);
          calculationDetails.push("--- Расчет Среднего Дневного Заработка ---");
          calculationDetails.push(...avgSalaryResult.details);


           const avgWage = avgSalaryResult.avgDailyWage ?? 0;
           const totalIncome = avgSalaryResult.totalAdjustedIncome ?? 0;
           const totalDays = avgSalaryResult.totalWorkingDays ?? 0;


           if (totalDays > 0) { // Расчет возможен только если были рабочие дни
                 if (totalIncome == 0 && monthlyIncomes.length > 0) {
                     calculationDetails.push("(!) Предупреждение: Введенные доходы были нулевыми или не попали в расчетный период.");
                 }


                calculationDetails.push("\n--- Расчет Оплачиваемых Дней Отпуска ---");
                const payableDaysResult = getWorkingDaysHoursInPeriod(vacationStartDate, vacationEndDate, workSchedule);
                calculationDetails.push(...payableDaysResult.details);


                const grossVacationPay = avgWage * payableDaysResult.payableWorkingDays;


                finalResult = {
                    "Тип расчета": "Отпускные",
                    "Период отпуска": `${vacationStartDate.toLocaleDateString()} - ${vacationEndDate.toLocaleDateString()}`,
                    "Расчетный период СДЗ": period.startDate ? `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}` : "N/A",
                    "График работы": workSchedule,
                    "Средний дневной заработок (СДЗ)": avgWage.toFixed(2),
                    "Общий доход для СДЗ": totalIncome.toFixed(2),
                    "Рабочих дней для СДЗ": totalDays,
                    "Календ. дней отпуска (в диапазоне)": payableDaysResult.calendarDays,
                    "Праздничных дней в периоде": payableDaysResult.holidaysCount,
                    "Оплачиваемых РАБОЧИХ дней отпуска": payableDaysResult.payableWorkingDays,
                    "Сумма отпускных (брутто)": grossVacationPay.toFixed(2) + " KZT"
                };
            } else {
                finalResult = { "Ошибка": "Не удалось рассчитать СДЗ (0 рабочих дней в расчетном периоде)." };
            }


      } else if (calculationType === 'compensation') {
          const terminationDateStr = form.terminationDate.value;
          const unusedVacationDays = parseInt(form.unusedVacationDays.value, 10);
           let terminationDate;


           if (!terminationDateStr) throw new Error("Не указана дата увольнения.");
           terminationDate = new Date(terminationDateStr);
           if (isNaN(terminationDate.getTime())) throw new Error("Некорректная дата увольнения.");
           if (isNaN(unusedVacationDays) || unusedVacationDays < 0) throw new Error("Некорректное количество неиспользованных дней отпуска.");


          const period = determineCalculationPeriod(terminationDate, hireDate);
          let avgSalaryResult;


           if (!period || !period.startDate) {
               calculationDetails.push("(!) Предупреждение: Расчетный период пуст (возможно, увольнение в месяц приема?). СДЗ будет 0.");
               avgSalaryResult = { avgDailyWage: 0, totalAdjustedIncome: 0, totalWorkingDays: 0, details: ["Расчетный период пуст."] };
           } else {
                avgSalaryResult = calculateAverageSalary(monthlyIncomes, workSchedule, increaseDetails, period);
           }


          calculationDetails.push("--- Расчет Среднего Дневного Заработка ---");
          calculationDetails.push(...avgSalaryResult.details);


           const avgWage = avgSalaryResult.avgDailyWage ?? 0;
           const totalIncome = avgSalaryResult.totalAdjustedIncome ?? 0;
           const totalDays = avgSalaryResult.totalWorkingDays ?? 0;


           if (unusedVacationDays === 0) {
                 finalResult = {
                     "Тип расчета": "Компенсация при увольнении",
                     "Дата увольнения": terminationDate.toLocaleDateString(),
                     "Неиспользовано дней отпуска (календ.)": 0,
                     "Сумма компенсации (брутто)": "0.00 KZT"
                 };
             } else if (totalDays > 0) { // СДЗ можно было рассчитать
                // Определение рабочих дней для компенсации
                let firstDayAfterTermination = new Date(terminationDate);
                firstDayAfterTermination.setDate(firstDayAfterTermination.getDate() + 1);
                // Пропускаем выходные и праздники для НАЧАЛА отсчета
                while(isHoliday(firstDayAfterTermination.toISOString().split('T')[0]) || isWeekend(firstDayAfterTermination, workSchedule)) {
                     firstDayAfterTermination.setDate(firstDayAfterTermination.getDate() + 1);
                }


                // Подсчет рабочих дней для N календарных дней отпуска
                let compensationPayableWorkingDays = 0;
                let tempDate = new Date(firstDayAfterTermination);
                let calendarDaysCounted = 0;
                let compensationPeriodEndDate = new Date(firstDayAfterTermination);


                calculationDetails.push(`\n--- Расчет Рабочих Дней для Компенсации (${unusedVacationDays} календ. дней) ---`);
                calculationDetails.push(`Отсчет с первого раб. дня после увольнения: ${firstDayAfterTermination.toLocaleDateString()}`);


                const loopLimit = unusedVacationDays * 5; // Ограничение
                let iteration = 0;


                while (calendarDaysCounted < unusedVacationDays && iteration < loopLimit) {
                    const dateStr = tempDate.toISOString().split('T')[0];
                     if (!isHoliday(dateStr)) { // Только праздники исключаем из КАЛЕНДАРНЫХ дней
                         calendarDaysCounted++;
                         compensationPeriodEndDate = new Date(tempDate); // Запоминаем последний день
                         if (!isWeekend(tempDate, workSchedule)) { // Рабочие дни считаем без выходных и праздников
                             compensationPayableWorkingDays++;
                             calculationDetails.push(`${tempDate.toLocaleDateString()}: Рабочий день (учитывается для оплаты)`);
                         } else {
                             calculationDetails.push(`${tempDate.toLocaleDateString()}: Выходной день (не добавляет раб. день, но входит в календ.)`);
                         }
                     } else {
                        calculationDetails.push(`${tempDate.toLocaleDateString()}: Праздничный день (пропускается)`);
                     }
                     tempDate.setDate(tempDate.getDate() + 1);
                     iteration++;
                 }
                 if (iteration >= loopLimit) {
                     calculationDetails.push("(!) Превышен лимит итераций при подсчете дней компенсации.");
                 }


                calculationDetails.push(`Итого РАБОЧИХ дней для оплаты компенсации: ${compensationPayableWorkingDays}`);


                const grossCompensationAmount = avgWage * compensationPayableWorkingDays;


                finalResult = {
                    "Тип расчета": "Компенсация при увольнении",
                    "Дата увольнения": terminationDate.toLocaleDateString(),
                    "Неиспользовано дней отпуска (календ.)": unusedVacationDays,
                    "Расчетный период СДЗ": period && period.startDate ? `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}` : "N/A",
                    "График работы": workSchedule,
                    "Средний дневной заработок (СДЗ)": avgWage.toFixed(2),
                    "Период раб. дней компенсации (примерно)": `${firstDayAfterTermination.toLocaleDateString()} - ${compensationPeriodEndDate.toLocaleDateString()}`,
                    "Рабочих дней для оплаты компенсации": compensationPayableWorkingDays,
                    "Сумма компенсации (брутто)": grossCompensationAmount.toFixed(2) + " KZT"
                };
            } else {
                 // Если totalWorkingDays = 0 (СДЗ рассчитать нельзя), а дни компенсации есть
                 finalResult = { "Ошибка": "Не удалось рассчитать СДЗ (0 рабочих дней в расчетном периоде), компенсация не может быть рассчитана." };
             }


      } else {
          throw new Error("Неизвестный тип расчета.");
      }
  } catch (error) {
      console.error("Ошибка расчета:", error);
      finalResult = { "Ошибка": error.message || "Произошла ошибка во время расчета." };
      calculationDetails.push(`КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
  }


  // Отображение результатов
  // Форматируем вывод JSON для лучшей читаемости
  let outputString = "Основные Результаты:\n";
  for(const key in finalResult) {
      outputString += `  ${key}: ${finalResult[key]}\n`;
  }


  outputString += `\nДетали Расчета:\n${calculationDetails.join('\n')}`;
  outputPre.textContent = outputString;
  resultsDiv.style.display = 'block';
 }

 // Инициализация формы при загрузке страницы
 document.addEventListener('DOMContentLoaded', setupForm);
