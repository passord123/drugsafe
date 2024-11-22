import React from 'react';

const DrugHistory = ({ doses = [], dosageUnit = 'mg' }) => {
  console.log('DrugHistory doses:', doses); // Debug log

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString() + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!Array.isArray(doses)) {
    console.log('Doses is not an array:', doses); // Debug log
    return (
      <div className="p-8 text-center text-gray-500">
        No dose history available (invalid data format)
      </div>
    );
  }

  if (doses.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No doses recorded yet
      </div>
    );
  }

  // Create a copy of the array before sorting
  const sortedDoses = [...doses].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  // Group doses
  const groupedDoses = sortedDoses.reduce((groups, dose) => {
    if (!dose || !dose.timestamp) return groups; // Skip invalid doses
    const date = new Date(dose.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(dose);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedDoses).map(([date, dailyDoses]) => (
        <div key={date} className="space-y-2">
          <div className="sticky top-0 bg-white p-2 border-b font-medium text-gray-600">
            {date === new Date().toDateString() ? 'Today' :
             date === new Date(Date.now() - 86400000).toDateString() ? 'Yesterday' :
             new Date(date).toLocaleDateString()}
          </div>
          {dailyDoses.map((dose, index) => (
            <div key={dose.id || index} className="flex items-center justify-between px-4 py-2 bg-white">
              <span className="font-medium">
                {typeof dose.dosage === 'number' ? dose.dosage : parseFloat(dose.dosage)} {dosageUnit}
              </span>
              <span className="text-sm text-gray-500">
                {date === new Date().toDateString() || 
                 date === new Date(Date.now() - 86400000).toDateString()
                  ? formatTimestamp(dose.timestamp).split(' at ')[1]
                  : formatTimestamp(dose.timestamp).split(' ')[1]
                }
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default DrugHistory;