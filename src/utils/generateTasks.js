// backend/src/utils/generateTasks.js - Refined task generation logic
const addBusinessDays = (startDate, days) => {
  let date = new Date(startDate);
  let addedDays = 0;
  while (addedDays < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) { // Not Sat/Sun
      addedDays++;
    }
  }
  return new Date(date);
};

const generateTasksForOrder = (orderId, registrationDate, plan, subplan) => {
  const tasks = [];
  const baseDate = new Date(registrationDate + 'T00:00:00');
  
  const isUltimate = (plan === 'marketing' && subplan === 'ultimate');
  const isStarter = (plan === 'marketing' && subplan === 'starter');
  const isWebsite = (plan === 'website');

  // Website plan does not show 24/48 cards
  if (isWebsite) {
    return [];
  }

  // Ultimate has 48 tasks, Starter has 24 tasks
  const totalCards = isUltimate ? 48 : 24;

  const taskTitles = ['Task 1', 'Task 2', 'Task 3', 'Task 4'];

  let currentDate = null;
  let cardsInCurrentMonth = 0;
  let currentMonth = -1;
  let currentYear = -1;

  for (let card = 1; card <= totalCards; card++) {
    const taskIndex = (card - 1) % 4; // 0, 1, 2, 3
    const taskNumber = taskIndex + 1; // 1, 2, 3, 4
    
    if (card === 1) {
      // First card: 10 business days after registration for ALL plans
      currentDate = addBusinessDays(baseDate, 10);
      currentMonth = currentDate.getMonth();
      currentYear = currentDate.getFullYear();
      cardsInCurrentMonth = 1;
    } else {
      if (isUltimate) {
        // Ultimate: 48 cards, 5 business days interval
        currentDate = addBusinessDays(currentDate, 5);
      } else if (isStarter) {
        // Starter Plan: Max 2 cards per month, 10 business days interval
        let nextDate = addBusinessDays(currentDate, 10);
        
        // Check if adding this card would exceed 2 cards in its month
        if (nextDate.getMonth() === currentMonth && nextDate.getFullYear() === currentYear && cardsInCurrentMonth >= 2) {
          // Move to next month
          let targetMonth = currentMonth + 1;
          let targetYear = currentYear;
          if (targetMonth > 11) {
            targetMonth = 0;
            targetYear++;
          }
          let nextMonthDate = new Date(targetYear, targetMonth, 1);
          // First business day of next month
          while (nextMonthDate.getDay() === 0 || nextMonthDate.getDay() === 6) {
            nextMonthDate.setDate(nextMonthDate.getDate() + 1);
          }
          currentDate = nextMonthDate;
        } else {
          currentDate = nextDate;
        }

        // Update tracking
        if (currentDate.getMonth() !== currentMonth || currentDate.getFullYear() !== currentYear) {
          currentMonth = currentDate.getMonth();
          currentYear = currentDate.getFullYear();
          cardsInCurrentMonth = 1;
        } else {
          cardsInCurrentMonth++;
        }
      } else {
        currentDate = addBusinessDays(currentDate, 5);
      }
    }

    tasks.push({
      order_id: orderId,
      task_number: taskNumber,
      card_number: card,
      title: taskTitles[taskIndex],
      description: `${taskTitles[taskIndex]} - Card ${card}`,
      due_date: new Date(currentDate).toISOString().split('T')[0],
      status: 'pending'
    });
  }
  return tasks;
};

module.exports = generateTasksForOrder;
