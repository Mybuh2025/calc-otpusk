<?php
 // --- УПРОЩЕННЫЕ ДАННЫЕ ПРОИЗВОДСТВЕННОГО КАЛЕНДАРЯ (ПРИМЕР НА 2025) ---
 $productionCalendarData = [
  2025 => [
  'holidays' => ["2025-01-01", "2025-01-02", "2025-01-07", "2025-03-08", "2025-03-21", "2025-03-22", "2025-03-23", /* Наурыз */
  "2025-03-31", /* Курбан айт (пример) */
  "2025-05-01", "2025-05-07", "2025-05-09", "2025-07-06", "2025-08-30", "2025-10-25", "2025-12-16"],
  'workDaysBalance' => [ // Примерные средние значения
  '5day' => [1 => 19, 2 => 20, 3 => 19, 4 => 22, 5 => 19, 6 => 21, 7 => 22, 8 => 21, 9 => 22, 10 => 22, 11 => 20, 12 => 21],
  '6day' => [1 => 23, 2 => 24, 3 => 24, 4 => 26, 5 => 24, 6 => 25, 7 => 27, 8 => 26, 9 => 26, 10 => 27, 11 => 25, 12 => 25]
  ]
  // Нужны также данные по часам для суммированного учета и среднемесячные показатели
  ]
 ];

 // --- Вспомогательные функции ---
 function isHoliday(string $dateStr, array $calendarData): bool {
  $year = (int) substr($dateStr, 0, 4);
  return isset($calendarData[$year]) && in_array($dateStr, $calendarData[$year]['holidays']);
 }

 function isWeekend(DateTime $date, string $workSchedule): bool {
  $dayOfWeek = (int) $date->format('N'); // 1 (for Monday) through 7 (for Sunday)
  if ($workSchedule === '5day') {
  return $dayOfWeek === 6 || $dayOfWeek === 7;
  } elseif ($workSchedule === '6day') {
  return $dayOfWeek === 7;
  }
  return false;
 }

 // --- Основные Функции Расчета ---

 /**
 * Определяет расчетный период
 */
 function determineCalculationPeriod(DateTime $eventDate, DateTime $hireDate): array {
  $endDate = clone $eventDate;
  $endDate->modify('last day of previous month');

  $startDate = clone $endDate;
  $startDate->modify('-1 year +1 day'); // Попытка получить 12 мес назад

  if ($hireDate > $startDate) {
       $startDate = clone $hireDate;
       // Корректировка endDate не нужна, т.к. берем конец пред. месяца
   }
   // Убедимся что дата начала не позже даты конца
   if ($startDate > $endDate && $hireDate <= $endDate) {
        $startDate = clone $hireDate; // Если период < 1 месяца
   } elseif ($startDate > $endDate) {
        // Ситуация когда событие в том же месяце что и наем - расчетный период пуст? Или 0? Уточнить методологию.
        // Для прототипа возвращаем null или пустой интервал
         return ['startDate' => null, 'endDate' => null];
   }


  return ['startDate' => $startDate, 'endDate' => $endDate];
 }

 /**
 * Рассчитывает Средний Дневной Заработок (СДЗ)
 */
 function calculateAverageSalary(array $monthlyIncomes, string $workSchedule, ?array $increaseDetails, array $calculationPeriod, DateTime $hireDate, array $calendarData): array {
  $totalAdjustedIncome = 0.0;
  $totalWorkingDays = 0;
  $details = [];
  $monthsProcessed = 0;


  if ($calculationPeriod['startDate'] === null || $calculationPeriod['endDate'] === null || $calculationPeriod['startDate'] > $calculationPeriod['endDate']) {
      $details[] = "Ошибка: Невозможно определить расчетный период.";
      return ['avgDailyWage' => 0, 'totalAdjustedIncome' => 0, 'totalWorkingDays' => 0, 'details' => $details];
  }


  // Коэффициент повышения
  $increaseCoefficient = 1.0;
  $increaseDate = null;
  if ($increaseDetails && !empty($increaseDetails['date']) && !empty($increaseDetails['oldSalary']) && !empty($increaseDetails['newSalary']) && $increaseDetails['newSalary'] > $increaseDetails['oldSalary']) {
  try {
  $increaseDate = new DateTime($increaseDetails['date']);
  $increaseCoefficient = (float)$increaseDetails['newSalary'] / (float)$increaseDetails['oldSalary'];
  $details[] = "Применен коэффициент повышения " . number_format($increaseCoefficient, 4) . " с " . $increaseDate->format('d.m.Y');
  } catch (Exception $e) {
  $increaseDate = null;
  $details[] = "(!) Ошибка в дате повышения оклада.";
  }
  } else {
  $details[] = "Коэффициент повышения не применялся.";
  }

  // Обработка доходов за расчетный период
  $period = new DatePeriod(
  clone $calculationPeriod['startDate'],
  new DateInterval('P1M'), // Интервал в 1 месяц
  (clone $calculationPeriod['endDate'])->modify('+1 day') // Включаем последний месяц
  );

  foreach ($period as $dt) {
        $year = (int) $dt->format('Y');
        $month = (int) $dt->format('n'); // 1-12
        $monthYearStr = $dt->format('Y-m');


      // Ищем доход за этот месяц
      $monthlyEligibleIncome = 0.0;
      foreach($monthlyIncomes as $inc) {
          if ($inc['monthYear'] === $monthYearStr) {
              $monthlyEligibleIncome = (float)$inc['income'];
              break;
          }
      }


      // Определение рабочих дней в месяце (УПРОЩЕННО)
      $workingDaysInMonth = 0;
       if (isset($calendarData[$year]['workDaysBalance'][$workSchedule][$month])) {
           $workingDaysInMonth = $calendarData[$year]['workDaysBalance'][$workSchedule][$month];
           // Нужна корректировка для неполных месяцев (первый/последний) на основе $hireDate и $calculationPeriod['endDate']
       } else {
           $details[] = "(!) Отсутствуют данные баланса раб. времени для $monthYearStr";
       }


      // Применение коэффициента повышения
      $adjustedIncome = $monthlyEligibleIncome;
      $firstDayOfMonth = new DateTime($dt->format('Y-m-01'));
      if ($increaseDate && $firstDayOfMonth < $increaseDate && $monthlyEligibleIncome > 0) {
      $adjustedIncome *= $increaseCoefficient;
       $details[] = "Месяц $monthYearStr: Доход " . number_format($monthlyEligibleIncome, 2) . " * " . number_format($increaseCoefficient, 4) . " = " . number_format($adjustedIncome, 2);
      } elseif ($monthlyEligibleIncome > 0) {
          $details[] = "Месяц $monthYearStr: Доход " . number_format($monthlyEligibleIncome, 2);
      }


       // Исключаемые периоды - НЕ РЕАЛИЗОВАНО


       $totalAdjustedIncome += $adjustedIncome;
       $totalWorkingDays += $workingDaysInMonth;
       $monthsProcessed++;
  }


  if ($monthsProcessed === 0 || $totalWorkingDays <= 0) {
  $details[] = "Ошибка: Нет данных о доходе или рабочих днях в расчетном периоде.";
  return ['avgDailyWage' => 0, 'totalAdjustedIncome' => 0, 'totalWorkingDays' => 0, 'details' => $details];
  }

  $avgDailyWage = $totalAdjustedIncome / $totalWorkingDays;
  $details[] = "Расчетный период: " . $calculationPeriod['startDate']->format('d.m.Y') . " - " . $calculationPeriod['endDate']->format('d.m.Y');
  $details[] = "Общий скорректированный доход: " . number_format($totalAdjustedIncome, 2);
  $details[] = "Всего рабочих дней в периоде ($workSchedule): $totalWorkingDays";
  $details[] = "Средний дневной заработок (СДЗ): " . number_format($avgDailyWage, 2);

  return ['avgDailyWage' => $avgDailyWage, 'totalAdjustedIncome' => $totalAdjustedIncome, 'totalWorkingDays' => $totalWorkingDays, 'details' => $details];
 }

 /**
 * Считает рабочие дни в периоде отпуска/компенсации
 */
 function getWorkingDaysHoursInPeriod(DateTime $startDate, DateTime $endDate, string $workSchedule, array $calendarData): array {
  $payableWorkingDays = 0;
  $calendarDays = 0;
  $holidaysCount = 0;
  $details = [];

  if ($startDate > $endDate) {
       $details[] = "Ошибка: Дата начала позже даты окончания.";
        return ['payableWorkingDays' => 0, 'calendarDays' => 0, 'holidaysCount' => 0, 'details' => $details];
  }


  $period = new DatePeriod(
  clone $startDate,
  new DateInterval('P1D'),
  (clone $endDate)->modify('+1 day')
  );

  foreach ($period as $date) {
  $calendarDays++;
  $dateStr = $date->format('Y-m-d');

  if (isHoliday($dateStr, $calendarData)) {
  $holidaysCount++;
   $details[] = $date->format('d.m.Y') . ": Праздничный день (не оплачивается, не учитывается в раб. днях)";
  } elseif (!isWeekend($date, $workSchedule)) {
  $payableWorkingDays++;
   $details[] = $date->format('d.m.Y') . ": Рабочий день (оплачивается)";
  } else {
       $details[] = $date->format('d.m.Y') . ": Выходной день (" . ($workSchedule === '5day' ? 'СБ/ВС' : 'ВС') . ") (не учитывается в раб. днях для оплаты)";
  }
  }
   $details[] = "Итого календарных дней в периоде: $calendarDays";
   $details[] = "Из них праздничных дней: $holidaysCount";
   $details[] = "Итого ОПЛАЧИВАЕМЫХ РАБОЧИХ ДНЕЙ ($workSchedule) в периоде: $payableWorkingDays";


  return ['payableWorkingDays' => $payableWorkingDays, 'calendarDays' => $calendarDays, 'holidaysCount' => $holidaysCount, 'details' => $details];
 }

 // --- Обработка запроса ---
 $results = null;
 $calculationDetails = [];
 $input = $_POST; // Используем POST для получения данных

 if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($input['calculate'])) {
  try {
  // Сбор данных
  $calculationType = $input['calculationType'] ?? 'vacation';
  $workSchedule = $input['workSchedule'] ?? '5day';
  $hireDateStr = $input['employeeHireDate'] ?? null;

  if (!$hireDateStr) throw new Exception("Не указана дата приема на работу.");
  $hireDate = new DateTime($hireDateStr);

  // Сбор доходов
  $monthlyIncomes = [];
  if (isset($input['income']) && is_array($input['income'])) {
  foreach ($input['income'] as $monthYear => $incomeVal) {
  if (!empty($incomeVal) && preg_match('/^\d{4}-\d{2}$/', $monthYear)) {
  $monthlyIncomes[] = [
  'monthYear' => $monthYear,
  'income' => (float) $incomeVal
  ];
  }
  }
  }
  if (empty($monthlyIncomes)) {
      // throw new Exception("Не введены данные о доходах.");
      // Или просто считаем с 0 доходом, как в JS версии
      $calculationDetails[] = "(!) Предупреждение: Не введены данные о доходах.";
   }


  // Повышение
  $increaseDetails = null;
  if (!empty($input['salaryIncreaseDate']) && !empty($input['oldSalary']) && !empty($input['newSalary'])) {
  $increaseDetails = [
  'date' => $input['salaryIncreaseDate'],
  'oldSalary' => (float) $input['oldSalary'],
  'newSalary' => (float) $input['newSalary']
  ];
  }

  // Исключаемые периоды - НЕ РЕАЛИЗОВАНО

  $finalResult = [];

  if ($calculationType === 'vacation') {
  $vacationStartDateStr = $input['vacationStartDate'] ?? null;
  $vacationEndDateStr = $input['vacationEndDate'] ?? null;
  if (!$vacationStartDateStr || !$vacationEndDateStr) throw new Exception("Не указаны даты отпуска.");
  $vacationStartDate = new DateTime($vacationStartDateStr);
  $vacationEndDate = new DateTime($vacationEndDateStr);
  if ($vacationEndDate < $vacationStartDate) throw new Exception("Дата окончания отпуска не может быть раньше даты начала.");

  $period = determineCalculationPeriod($vacationStartDate, $hireDate);
   if($period['startDate'] === null) throw new Exception("Не удалось определить расчетный период (возможно, отпуск в месяц приема?).");


  $avgSalaryResult = calculateAverageSalary($monthlyIncomes, $workSchedule, $increaseDetails, $period, $hireDate, $productionCalendarData);
  $calculationDetails[] = "--- Расчет Среднего Дневного Заработка ---";
  $calculationDetails = array_merge($calculationDetails, $avgSalaryResult['details']);

  if ($avgSalaryResult['avgDailyWage'] > 0) {
  $calculationDetails[] = "\n--- Расчет Оплачиваемых Дней Отпуска ---";
  $payableDaysResult = getWorkingDaysHoursInPeriod($vacationStartDate, $vacationEndDate, $workSchedule, $productionCalendarData);
  $calculationDetails = array_merge($calculationDetails, $payableDaysResult['details']);

  $grossVacationPay = $avgSalaryResult['avgDailyWage'] * $payableDaysResult['payableWorkingDays'];

  $finalResult = [
  "Тип расчета" => "Отпускные",
  "Период отпуска" => $vacationStartDate->format('d.m.Y') . " - " . $vacationEndDate->format('d.m.Y'),
  "Расчетный период СДЗ" => $period['startDate']->format('d.m.Y') . " - " . $period['endDate']->format('d.m.Y'),
  "График работы" => $workSchedule,
  "Средний дневной заработок (СДЗ)" => number_format($avgSalaryResult['avgDailyWage'], 2),
  "Общий доход для СДЗ" => number_format($avgSalaryResult['totalAdjustedIncome'], 2),
  "Рабочих дней для СДЗ" => $avgSalaryResult['totalWorkingDays'],
  "Календ. дней отпуска (в диапазоне)" => $payableDaysResult['calendarDays'],
  "Праздничных дней в периоде" => $payableDaysResult['holidaysCount'],
  "Оплачиваемых РАБОЧИХ дней отпуска" => $payableDaysResult['payableWorkingDays'],
  "Сумма отпускных (брутто)" => number_format($grossVacationPay, 2) . " KZT"
  ];
  } else {
  $finalResult = ["Ошибка" => "Не удалось рассчитать СДЗ."];
  }

  } elseif ($calculationType === 'compensation') {
  $terminationDateStr = $input['terminationDate'] ?? null;
  $unusedVacationDays = isset($input['unusedVacationDays']) ? (int) $input['unusedVacationDays'] : 0;
  if (!$terminationDateStr) throw new Exception("Не указана дата увольнения.");
   if ($unusedVacationDays < 0) throw new Exception("Количество дней отпуска не может быть отрицательным.");
  $terminationDate = new DateTime($terminationDateStr);


   $period = determineCalculationPeriod($terminationDate, $hireDate);
    if($period['startDate'] === null && $unusedVacationDays > 0) {
       // Если период расчета пуст, но есть дни компенсации - СДЗ = 0? Или брать МЗП? Уточнить методологию.
       // Пока что будет ошибка ниже при делении на 0 раб. дней
       $calculationDetails[] = "(!) Предупреждение: Расчетный период пуст (возможно, увольнение в месяц приема?).";
   }


   $avgSalaryResult = calculateAverageSalary($monthlyIncomes, $workSchedule, $increaseDetails, $period, $hireDate, $productionCalendarData);
   $calculationDetails[] = "--- Расчет Среднего Дневного Заработка ---";
   $calculationDetails = array_merge($calculationDetails, $avgSalaryResult['details']);


  if ($unusedVacationDays === 0) {
       $finalResult = [
           "Тип расчета" => "Компенсация при увольнении",
           "Дата увольнения" => $terminationDate->format('d.m.Y'),
           "Неиспользовано дней отпуска (календ.)" => 0,
           "Сумма компенсации (брутто)" => "0.00 KZT"
       ];
   } elseif ($avgSalaryResult['avgDailyWage'] > 0) {
  // Определение рабочих дней для компенсации
  $firstDayAfterTermination = clone $terminationDate;
  $firstDayAfterTermination->modify('+1 day');
  // Пропускаем выходные и праздники для НАЧАЛА отсчета
  while (isHoliday($firstDayAfterTermination->format('Y-m-d'), $productionCalendarData) || isWeekend($firstDayAfterTermination, $workSchedule)) {
  $firstDayAfterTermination->modify('+1 day');
  }

  // Подсчет рабочих дней для N календарных дней отпуска
  $compensationPayableWorkingDays = 0;
  $tempDate = clone $firstDayAfterTermination;
  $calendarDaysCounted = 0;
  $compensationPeriodEndDate = clone $firstDayAfterTermination;


   $calculationDetails[] = "\n--- Расчет Рабочих Дней для Компенсации ($unusedVacationDays календ. дней) ---";
   $calculationDetails[] = "Отсчет с первого раб. дня после увольнения: " . $firstDayAfterTermination->format('d.m.Y');


  while ($calendarDaysCounted < $unusedVacationDays) {
  $dateStr = $tempDate->format('Y-m-d');
  if (!isHoliday($dateStr, $productionCalendarData)) { // Только праздники исключаем из КАЛЕНДАРНЫХ дней
  $calendarDaysCounted++;
  $compensationPeriodEndDate = clone $tempDate; // Запоминаем последний день
  if (!isWeekend($tempDate, $workSchedule)) { // Рабочие дни считаем без выходных и праздников
  $compensationPayableWorkingDays++;
   $calculationDetails[] = $tempDate->format('d.m.Y') . ": Рабочий день (учитывается для оплаты)";
  } else {
   $calculationDetails[] = $tempDate->format('d.m.Y') . ": Выходной день (не добавляет раб. день, но входит в календ.)";
  }
  } else {
   $calculationDetails[] = $tempDate->format('d.m.Y') . ": Праздничный день (пропускается)";
  }
  $tempDate->modify('+1 day');
  // Добавить защиту от бесконечного цикла, если что-то пойдет не так
   if ($calendarDaysCounted > $unusedVacationDays * 3) { // Условный предел
       $calculationDetails[] = "(!) Превышен лимит итераций при подсчете дней компенсации.";
       break;
   }
  }


  $calculationDetails[] = "Итого РАБОЧИХ дней для оплаты компенсации: $compensationPayableWorkingDays";


  $grossCompensationAmount = $avgSalaryResult['avgDailyWage'] * $compensationPayableWorkingDays;


  $finalResult = [
  "Тип расчета" => "Компенсация при увольнении",
  "Дата увольнения" => $terminationDate->format('d.m.Y'),
  "Неиспользовано дней отпуска (календ.)" => $unusedVacationDays,
  "Расчетный период СДЗ" => ($period['startDate'] ? $period['startDate']->format('d.m.Y') : 'N/A') . " - " . ($period['endDate'] ? $period['endDate']->format('d.m.Y'): 'N/A'),
  "График работы" => $workSchedule,
  "Средний дневной заработок (СДЗ)" => number_format($avgSalaryResult['avgDailyWage'], 2),
   "Период раб. дней компенсации (примерно)" => $firstDayAfterTermination->format('d.m.Y') . " - " . $compensationPeriodEndDate->format('d.m.Y'),
  "Рабочих дней для оплаты компенсации" => $compensationPayableWorkingDays,
  "Сумма компенсации (брутто)" => number_format($grossCompensationAmount, 2) . " KZT"
  ];
  } else {
       $finalResult = ["Ошибка" => "Не удалось рассчитать СДЗ или нет дней для компенсации."];
   }


  } else {
  throw new Exception("Неизвестный тип расчета.");
  }

  $results = $finalResult;

  } catch (Exception $e) {
  $results = ["Ошибка" => $e->getMessage()];
  $calculationDetails[] = "КРИТИЧЕСКАЯ ОШИБКА: " . $e->getMessage();
  }
 }
 ?>

 <!DOCTYPE html>
 <html lang="ru">
 <head>
  <meta charset="UTF-8">
  <title>Калькулятор Отпускных и Компенсации (PHP Прототип)</title>
  <style>
  body { font-family: sans-serif; }
  .container { max-width: 800px; margin: 20px auto; padding: 15px; border: 1px solid #ccc; }
  label { display: block; margin-top: 10px; }
  input, select { width: 95%; padding: 8px; margin-top: 5px; max-width: 400px;}
  button { padding: 10px 15px; margin-top: 15px; cursor: pointer; }
  #results { margin-top: 20px; padding: 10px; background-color: #f0f0f0; border: 1px solid #ddd; white-space: pre-wrap; }
  .income-month { display: flex; align-items: center; margin-bottom: 5px; flex-wrap: wrap; }
  .income-month label { flex-basis: 100px; margin-right: 10px; margin-top: 5px;}
  .income-month input { flex-grow: 1; min-width: 150px; margin-top: 5px;}
   fieldset { margin-top: 20px; }
  </style>
  <script>
   // Скрипт для переключения полей и динамического добавления доходов
   function setupForm() {
    const calcTypeSelect = document.getElementById('calculationType');
    const vacationFields = document.getElementById('vacationFields');
    const compensationFields = document.getElementById('compensationFields');
    const monthlyIncomeDiv = document.getElementById('monthlyIncomeDetails');
    const hireDateInput = document.getElementById('employeeHireDate');


    function toggleFields() {
     if (!calcTypeSelect) return; // Защита
     const isVacation = calcTypeSelect.value === 'vacation';
     vacationFields.style.display = isVacation ? 'block' : 'none';
     compensationFields.style.display = isVacation ? 'none' : 'block';
     updateIncomeFields(); // Обновляем поля при смене типа
    }


    function updateIncomeFields() {
        if (!monthlyIncomeDiv || !hireDateInput) return; // Защита


        monthlyIncomeDiv.innerHTML = ''; // Очистить старые поля
        const eventDateElement = calcTypeSelect.value === 'vacation'
                                ? document.getElementById('vacationStartDate')
                                : document.getElementById('terminationDate');
        let eventDateVal = eventDateElement ? eventDateElement.value : null;
        let eventDate = eventDateVal ? new Date(eventDateVal) : new Date();
        if (isNaN(eventDate)) eventDate = new Date();


         const hireDateVal = hireDateInput.value;
         if (!hireDateVal) {
             monthlyIncomeDiv.innerHTML = '<p><i>Укажите дату приема на работу</i></p>';
             return;
         }
         const hireDate = new Date(hireDateVal);
         if (isNaN(hireDate)) {
              monthlyIncomeDiv.innerHTML = '<p><i>Неверная дата приема на работу</i></p>';
             return;
         }


         // Определяем период на клиенте для генерации полей (логика упрощена)
         let endDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), 0); // Конец предыдущего месяца
         let startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth() + 1, 1);
         if (hireDate > startDate) {
             startDate = new Date(hireDate);
         }


         let currentMonth = new Date(endDate);


         for (let i = 0; i < 12; i++) {
             if (currentMonth < startDate && startDate >= hireDate) break;


             const year = currentMonth.getFullYear();
             const month = currentMonth.getMonth(); // 0-11
             const monthYearStr = `<span class="math-inline">\{year\}\-</span>{String(month + 1).padStart(2, '0')}`;


             const monthDiv = document.createElement('div');
             monthDiv.classList.add('income-month');


             const label = document.createElement('label');
             label.setAttribute('for', `income_${monthYearStr}`);
             label.textContent = `${monthYearStr}:`;


             const input = document.createElement('input');
             input.type = 'number';
             // Используем name="income[YYYY-MM]" для передачи в PHP как массив
             input.name = `income[${monthYearStr}]`;
             input.id = `income_${monthYearStr}`;
             input.step = '0.01';
             input.placeholder = 'Учитываемый доход';


             monthDiv.appendChild(label);
             monthDiv.appendChild(input);
             monthlyIncomeDiv.prepend(monthDiv); // Добавляем в начало


             // Переход к предыдущему месяцу
             currentMonth.setMonth(currentMonth.getMonth() - 1);
         }
     }


    // Привязка обработчиков
    if (calcTypeSelect) calcTypeSelect.addEventListener('change', toggleFields);
    const eventDateElements = [
        document.getElementById('vacationStartDate'),
        document.getElementById('terminationDate'),
        hireDateInput
    ];
    eventDateElements.forEach(el => {
        if(el) el.addEventListener('change', updateIncomeFields);
    });


    // Инициализация
    toggleFields();
   }


   document.addEventListener('DOMContentLoaded', setupForm);
  </script>
 </head>
 <body>
  <div class="container">
  <h1>Калькулятор Отпускных и Компенсации (PHP Прототип)</h1>

  <form id="calculatorForm" method="POST" action="index.php">
  <label for="calculationType">Тип расчета:</label>
  <select id="calculationType" name="calculationType">
  <option value="vacation" <?= (isset($input['calculationType']) && $input['calculationType'] == 'vacation') ? 'selected' : '' ?>>Отпускные</option>
  <option value="compensation" <?= (isset($input['calculationType']) && $input['calculationType'] == 'compensation') ? 'selected' : '' ?>>Компенсация при увольнении</option>
  </select>

  <label for="workSchedule">График работы:</label>
  <select id="workSchedule" name="workSchedule">
  <option value="5day" <?= (isset($input['workSchedule']) && $input['workSchedule'] == '5day') ? 'selected' : '' ?>>5-дневка</option>
  <option value="6day" <?= (isset($input['workSchedule']) && $input['workSchedule'] == '6day') ? 'selected' : '' ?>>6-дневка</option>
  </select>

  <div id="vacationFields" style="display: <?= (!isset($input['calculationType']) || $input['calculationType'] == 'vacation') ? 'block' : 'none' ?>;">
  <label for="vacationStartDate">Дата начала отпуска:</label>
  <input type="date" id="vacationStartDate" name="vacationStartDate" value="<?= htmlspecialchars($input['vacationStartDate'] ?? '') ?>">
  <label for="vacationEndDate">Дата окончания отпуска:</label>
  <input type="date" id="vacationEndDate" name="vacationEndDate" value="<?= htmlspecialchars($input['vacationEndDate'] ?? '') ?>">
  </div>

  <div id="compensationFields" style="display: <?= (isset($input['calculationType']) && $input['calculationType'] == 'compensation') ? 'block' : 'none' ?>;">
  <label for="terminationDate">Дата увольнения:</label>
  <input type="date" id="terminationDate" name="terminationDate" value="<?= htmlspecialchars($input['terminationDate'] ?? '') ?>">
  <label for="unusedVacationDays">Неиспользовано дней отпуска (календ.):</label>
  <input type="number" id="unusedVacationDays" name="unusedVacationDays" value="<?= htmlspecialchars($input['unusedVacationDays'] ?? '0') ?>" min="0">
  </div>

  <label for="employeeHireDate">Дата приема на работу:</label>
  <input type="date" id="employeeHireDate" name="employeeHireDate" value="<?= htmlspecialchars($input['employeeHireDate'] ?? '') ?>" required>

  <fieldset>
  <legend>Доходы по месяцам за расчетный период</legend>
  <div id="monthlyIncomeDetails">
      <?php if (!empty($input['income']) && is_array($input['income'])): ?>
          <?php foreach ($input['income'] as $mYear => $mIncome): ?>
              <div class="income-month">
                  <label for="income_<?= htmlspecialchars($mYear) ?>"><?= htmlspecialchars($mYear) ?>:</label>
                  <input type="number" id="income_<?= htmlspecialchars($mYear) ?>" name="income[<?= htmlspecialchars($mYear) ?>]" step="0.01" placeholder="Учитываемый доход" value="<?= htmlspecialchars($mIncome) ?>">
              </div>
          <?php endforeach; ?>
      <?php endif; ?>
  </div>
  </fieldset>

  <fieldset>
       <legend>Повышение оклада (если было в расч. периоде или до события)</legend>
       <label for="salaryIncreaseDate">Дата повышения:</label>
       <input type="date" id="salaryIncreaseDate" name="salaryIncreaseDate" value="<?= htmlspecialchars($input['salaryIncreaseDate'] ?? '') ?>">
       <label for="oldSalary">Старый оклад:</label>
       <input type="number" id="oldSalary" name="oldSalary" step="0.01" value="<?= htmlspecialchars($input['oldSalary'] ?? '') ?>">
       <label for="newSalary">Новый оклад:</label>
       <input type="number" id="newSalary" name="newSalary" step="0.01" value="<?= htmlspecialchars($input['newSalary'] ?? '') ?>">
   </fieldset>

  <button type="submit" name="calculate">Рассчитать</button>
  </form>

  <?php if ($results !== null): ?>
  <div id="results">
  <h2>Результаты расчета:</h2>
  <?php if (isset($results['Ошибка'])): ?>
  <p style="color: red;"><strong>Ошибка:</strong> <?= htmlspecialchars($results['Ошибка']) ?></p>
  <?php else: ?>
  <ul>
  <?php foreach ($results as $key => $value): ?>
  <li><strong><?= htmlspecialchars($key) ?>:</strong> <?= htmlspecialchars($value) ?></li>
  <?php endforeach; ?>
  </ul>
  <?php endif; ?>

  <?php if (!empty($calculationDetails)): ?>
  <h3>Детали расчета:</h3>
  <pre><?= htmlspecialchars(implode("\n", $calculationDetails)) ?></pre>
  <?php endif; ?>
   <p><small><strong>Дисклеймер:</strong> Расчеты являются предварительными. Рекомендуется консультация со специалистом.</small></p>
  </div>
  <?php endif; ?>

  </div>
 </body>
 </html>