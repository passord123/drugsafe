import React, { useState, useEffect } from 'react';
import { Clock, Settings, AlertTriangle, PlusCircle, History, X, Package } from 'lucide-react';
import DrugTimeline from './DrugTimeline';
import { getSubstanceProfile } from './DrugTimer/timingProfiles';
import { useNavigate } from 'react-router-dom';
import { Alert } from './DrugTimer/Alert';
import MobileModal from './layout/MobileModal';
import DrugHistory from './DrugHistory';
import PropTypes from 'prop-types';
import { getDrugTiming, calculateNextDoseTime, checkDoseSafety } from '../utils/drugTimingHandler';
import { useAlerts } from '../contexts/AlertContext';
import { timingProfiles, categoryProfiles } from './DrugTimer/timingProfiles';
import DrugTrackerHeader from './DrugTrackerHeader';


const DrugTracker = ({ drug, onRecordDose, onUpdateSettings }) => {
  // Core state
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [customDosage, setCustomDosage] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [lastDoseTimer, setLastDoseTimer] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDoseModal, setShowDoseModal] = useState(false);
  const [safetyChecks, setSafetyChecks] = useState(null);

  // Time tracking state
  const [selectedTime, setSelectedTime] = useState('now');
  const [customTime, setCustomTime] = useState(new Date().toISOString().slice(0, 16));

  // Settings state
  const [standardDose, setStandardDose] = useState(drug.dosage || '');
  const [maxDailyDoses, setMaxDailyDoses] = useState(drug.settings?.maxDailyDoses || 4);
  const [enableSupply, setEnableSupply] = useState(drug.settings?.trackSupply || false);
  const [currentSupply, setCurrentSupply] = useState(drug.settings?.currentSupply || 0);
  const [showTimeline, setShowTimeline] = useState(
    drug.settings?.showTimeline !== undefined ? drug.settings.showTimeline : true
  );

  // Timing profile state
  const [useRecommendedTiming, setUseRecommendedTiming] = useState(true);
  const [minTimeBetweenDoses, setMinTimeBetweenDoses] = useState(
    drug.settings?.minTimeBetweenDoses || getDefaultTiming()
  );

  // Get timing from profile
  function getDefaultTiming() {
    const profile = timingProfiles[drug.name.toLowerCase()] ||
      categoryProfiles[drug.category] ||
      timingProfiles.default;
    return profile.total() / 60; // Convert minutes to hours
  }

  // Format duration for display
  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);

    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }

  // Get the timing profile for the current drug
  const getTimingProfile = () => {
    return timingProfiles[drug.name.toLowerCase()] ||
      categoryProfiles[drug.category] ||
      timingProfiles.default;
  };

  // Get formatted total duration
  const getTotalDuration = () => {
    const profile = getTimingProfile();
    const totalMinutes = profile.total();
    return formatDuration(totalMinutes);
  };

  // Helper function to format date for input
  const formatDateTimeLocal = (date) => {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  // Effects
  useEffect(() => {
    if (drug.doses?.[0]) {
      const lastDoseTime = new Date(drug.doses[0].timestamp);
      const interval = setInterval(() => {
        const now = new Date();
        const timeSince = (now - lastDoseTime) / (1000 * 60 * 60);
        setLastDoseTimer(timeSince);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [drug.doses]);

  useEffect(() => {
    const standardDose = getStandardDose();
    setStandardDose(standardDose);
  }, [drug]);

  // Alert handling
  const addAlert = (type, message, duration = 5000) => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, duration);
  };

  const handleSaveSettings = () => {
    const profile = getTimingProfile();
    const totalMinutes = profile.total();

    const updatedSettings = {
      ...drug.settings,
      defaultDosage: standardDose,
      defaultDosageUnit: drug.dosageUnit,
      maxDailyDoses: Number(maxDailyDoses),
      minTimeBetweenDoses: useRecommendedTiming ? totalMinutes / 60 : Number(minTimeBetweenDoses),
      trackSupply: enableSupply,
      currentSupply: enableSupply ? Number(currentSupply) : null,
      showTimeline: showTimeline,
      useRecommendedTiming
    };

    onUpdateSettings(drug.id, updatedSettings);
    setShowSettings(false);
    addAlert('info', 'Settings updated successfully');
  };

  const handleStartEditingDose = () => {
    const standardDose = getStandardDose();
    setCustomDosage(standardDose);
    setCustomTime(formatDateTimeLocal(new Date()));
    setSelectedTime('now');
    setShowDoseModal(true);
  };

  const checkSafetyRestrictions = (doseTime = new Date()) => {
    const today = doseTime.toDateString();
    const dosesToday = drug.doses?.filter(dose =>
      new Date(dose.timestamp).toDateString() === today
    ).length || 0;

    const lastDose = drug.doses?.[0]?.timestamp;
    const timeSinceLastDose = lastDose
      ? (doseTime - new Date(lastDose)) / (1000 * 60 * 60)
      : Infinity;

    const profile = getTimingProfile();
    const recommendedHours = profile.total() / 60;

    return {
      hasTimeRestriction: timeSinceLastDose < (useRecommendedTiming ? recommendedHours : drug.settings.minTimeBetweenDoses),
      hasQuotaRestriction: dosesToday >= drug.settings.maxDailyDoses,
      timeSinceLastDose,
      dosesToday,
      recommendedWaitTime: recommendedHours
    };
  };

  const handleRecordDose = () => {
    const dosageNum = parseFloat(customDosage);

    if (!customDosage || isNaN(dosageNum) || dosageNum <= 0) {
      addAlert('error', 'Please enter a valid dosage');
      return;
    }

    let doseTime;
    if (selectedTime === 'now') {
      doseTime = new Date();
    } else {
      doseTime = new Date(customTime);
    }

    // Safety check
    const safetyCheck = checkSafetyRestrictions(doseTime);
    if (safetyCheck.hasTimeRestriction || safetyCheck.hasQuotaRestriction) {
      setSafetyChecks(safetyCheck);
      setShowOverrideConfirm(true);
      return;
    }

    const newDose = {
      id: Date.now(),
      timestamp: doseTime.toISOString(),
      dosage: dosageNum,
      status: 'normal'
    };

    // Get current drug data from localStorage
    const drugs = JSON.parse(localStorage.getItem('drugs') || '[]');
    const currentDrug = drugs.find(d => d.id === drug.id);

    if (!currentDrug) {
      addAlert('error', 'Drug not found');
      return;
    }

    // Update drug with new dose
    const updatedDrug = {
      ...currentDrug,
      doses: [newDose, ...(currentDrug.doses || [])],
      settings: {
        ...currentDrug.settings,
        currentSupply: enableSupply
          ? Math.max(0, (currentDrug.settings?.currentSupply || 0) - dosageNum)
          : currentDrug.settings?.currentSupply
      }
    };

    // Update localStorage
    const updatedDrugs = drugs.map(d => d.id === drug.id ? updatedDrug : d);
    localStorage.setItem('drugs', JSON.stringify(updatedDrugs));

    // Update parent component
    onRecordDose(drug.id, updatedDrug);

    // Reset UI
    setShowDoseModal(false);
    setCustomDosage('');
    setSelectedTime('now');

    addAlert('success', 'Dose recorded successfully');
  };
  const handleOverrideDose = () => {
    if (!customDosage || !drug) return;

    const dosageNum = parseFloat(customDosage);

    let doseTime;
    if (selectedTime === 'now') {
      doseTime = new Date();
    } else {
      doseTime = new Date(customTime);
    }

    const newSupply = enableSupply
      ? Math.max(0, (drug.settings?.currentSupply || 0) - dosageNum)
      : null;

    // Create the dose data
    const doseData = {
      id: Date.now(),
      timestamp: doseTime.toISOString(),
      dosage: dosageNum,
      status: 'override',
      overrideReason: overrideReason || 'Safety override'
    };

    // Update the doses array
    const updatedDoses = [doseData, ...(drug.doses || [])];

    // Update the drug with new doses array
    const updatedDrug = {
      ...drug,
      doses: updatedDoses,
      settings: {
        ...drug.settings,
        currentSupply: newSupply
      }
    };

    // Log the override for record keeping
    const safetyChecks = checkSafetyRestrictions(doseTime);
    const overrideLog = {
      timestamp: doseTime.toISOString(),
      drugId: drug.id,
      drugName: drug.name,
      reason: overrideReason,
      timeSinceLastDose: safetyChecks.timeSinceLastDose,
      dosesToday: safetyChecks.dosesToday
    };

    // Store override log in localStorage
    const overrideLogs = JSON.parse(localStorage.getItem(`${drug.id}_overrides`) || '[]');
    overrideLogs.push(overrideLog);
    localStorage.setItem(`${drug.id}_overrides`, JSON.stringify(overrideLogs));

    // Record the dose with override
    onRecordDose(drug.id, updatedDrug);

    // Reset UI state
    setShowDoseModal(false);
    setShowOverrideConfirm(false);
    setOverrideReason('');
    setCustomDosage('');
    setSelectedTime('now');

    // Show warning alert
    addAlert('warning', 'Dose recorded with safety override', 8000);
  };

  const handleResetTimer = () => {
    const updatedDoses = drug.doses?.filter(dose =>
      dose.id !== drug.doses[0].id
    ) || [];

    onUpdateSettings(drug.id, {
      ...drug.settings,
      doses: updatedDoses
    });

    setShowResetConfirm(false);
    addAlert('info', 'Timer has been reset');
  };

  // Helper functions
  const getStandardDose = () => {
    return drug.settings?.defaultDosage?.amount ||
      drug.settings?.defaultDosage ||
      drug.dosage || '';
  };

  const getDrugWithDoses = () => {
    const drugs = JSON.parse(localStorage.getItem('drugs') || '[]');
    return drugs.find(d => d.id === drug.id) || drug;
  };

  const renderHistory = () => {
    const currentDrug = getDrugWithDoses();
    return (
      <DrugHistory
        doses={currentDrug.doses || []}
        dosageUnit={currentDrug.settings?.defaultDosage?.unit || currentDrug.dosageUnit || 'mg'}
      />
    );
  };
  return (
    <div className="p-6 space-y-6">
      {/* New Enhanced Header */}
      <DrugTrackerHeader
        drug={drug}
        onOpenHistory={() => setShowHistory(true)}
        onOpenSettings={() => setShowSettings(true)}
        lastDoseTime={drug.doses?.[0]?.timestamp}
      />

      {/* Supply Status */}
      {enableSupply && (
        <div className={`p-4 rounded-lg border ${drug.settings?.currentSupply <= 0 ? 'bg-red-50 border-red-200' :
          drug.settings?.currentSupply <= 5 ? 'bg-yellow-50 border-yellow-200' :
            'bg-blue-50 border-blue-200'
          }`}>
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5" />
            <div>
              <h3 className="font-medium">Current Supply</h3>
              <p className="text-sm mt-1">
                {drug.settings?.currentSupply || 0} {drug.dosageUnit} remaining
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`p-4 rounded-lg border ${alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
              'bg-blue-50 border-blue-200 text-blue-700'
            }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{alert.message}</span>
          </div>
        </div>
      ))}

      {/* Drug Timeline */}
      {showTimeline && (
        <DrugTimeline
          lastDoseTime={drug.doses?.[0]?.timestamp}
          drugName={drug.name}
        />
      )}

      {/* Modals */}
      <MobileModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Drug Settings"
        fullScreen
      >
        <div className="p-4 space-y-6">
          {/* Timeline Toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTimeline}
                onChange={(e) => setShowTimeline(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Show Effect Timeline
              </span>
            </label>
          </div>

          {/* Standard Dose Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Standard Dose ({drug.dosageUnit})
            </label>
            <input
              type="number"
              value={standardDose}
              onChange={(e) => setStandardDose(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="any"
            />
          </div>

          {/* Timing Settings */}
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useRecommendedTiming}
                onChange={(e) => setUseRecommendedTiming(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Use Recommended Timing
              </span>
            </label>

            {useRecommendedTiming ? (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  Recommended time between doses: {getTotalDuration()}
                </p>
                <p className="text-sm text-blue-800 mt-2">
                  Based on {drug.name}'s effect profile
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Time Between Doses (hours)
                </label>
                <input
                  type="number"
                  value={minTimeBetweenDoses}
                  onChange={(e) => setMinTimeBetweenDoses(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.5"
                />
              </div>
            )}
          </div>

          {/* Max Daily Doses Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Maximum Doses per Day
            </label>
            <input
              type="number"
              value={maxDailyDoses}
              onChange={(e) => setMaxDailyDoses(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          {/* Supply Management */}
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableSupply}
                onChange={(e) => setEnableSupply(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Track Supply
              </span>
            </label>

            {enableSupply && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Current Supply ({drug.dosageUnit})
                </label>
                <input
                  type="number"
                  value={currentSupply}
                  onChange={(e) => setCurrentSupply(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="any"
                />
              </div>
            )}
          </div>

          {/* Safety Information */}
          {drug.warnings && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{drug.warnings}</p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3">
          <button
            onClick={handleSaveSettings}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Save Settings
          </button>
          <button
            onClick={() => setShowSettings(false)}
            className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </MobileModal>

      {/* Dose Recording Modal */}
      <MobileModal
        isOpen={showDoseModal}
        onClose={() => {
          setShowDoseModal(false);
          setCustomDosage('');
          setSelectedTime('now');
        }}
        title="Record Dose"
        fullScreen
      >
        <div className="p-4 space-y-6">
          {/* Dosage Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Dose Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={customDosage}
                onChange={(e) => setCustomDosage(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter amount"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {drug.dosageUnit}
              </span>
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Time Taken
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="now">Just now</option>
                <option value="custom">Custom time</option>
              </select>
              {selectedTime === 'custom' && (
                <input
                  type="datetime-local"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  max={formatDateTimeLocal(new Date())}
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>

          {/* Timing Information */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <h3 className="font-medium text-blue-900">Recommended Timing</h3>
            <p className="text-sm text-blue-800">
              Total duration: {getTotalDuration()}
            </p>
            <p className="text-sm text-blue-800">
              Wait untill offset before redosing
            </p>
          </div>

          {/* Safety Warnings */}
          {drug.warnings && (
            <div className="bg-red-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-medium text-red-900">Safety Warning</h3>
              </div>
              <p className="text-red-800">{drug.warnings}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2">
          <button
            onClick={handleRecordDose}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Record
          </button>
          <button
            onClick={() => {
              setShowDoseModal(false);
              setCustomDosage('');
              setSelectedTime('now');
            }}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </MobileModal>

      {/* Safety Override Modal */}
      <MobileModal
        isOpen={showOverrideConfirm}
        onClose={() => {
          setShowOverrideConfirm(false);
          setOverrideReason('');
        }}
        title="Safety Override"
        fullScreen
      >
        <div className="p-4 space-y-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Safety Override Required</h3>
              <p className="mt-2 text-gray-600">
                {safetyChecks?.hasTimeRestriction &&
                  `Time since last dose: ${safetyChecks.timeSinceLastDose.toFixed(1)} hours (recommended: ${formatDuration(getTimingProfile().total())})`}
                {safetyChecks?.hasQuotaRestriction &&
                  `Daily dose limit (${drug.settings.maxDailyDoses}) reached`}
              </p>
            </div>
          </div>

          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Please provide a reason for override (required)"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
            rows={3}
          />

          {drug.warnings && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {drug.warnings}
            </div>
          )}

          <div className="sticky bottom-0 bg-white pt-4 flex gap-3">
            <button
              onClick={handleOverrideDose}
              disabled={!overrideReason.trim()}
              className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Override Safety Check
            </button>
            <button
              onClick={() => {
                setShowOverrideConfirm(false);
                setOverrideReason('');
              }}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </MobileModal>

      {/* History Modal */}
      <MobileModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Dose History"
        fullScreen
      >
        {renderHistory()}
      </MobileModal>

      {/* Record Dose Button */}
      <button
        onClick={handleStartEditingDose}
        className="w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 
                 bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        disabled={enableSupply && drug.settings?.currentSupply <= 0}
      >
        <PlusCircle className="w-5 h-5" />
        <span>
          {enableSupply && drug.settings?.currentSupply <= 0
            ? 'No Supply Available'
            : 'Record New Dose'
          }
        </span>
      </button>
    </div>
  );
};

DrugTracker.propTypes = {
  drug: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    dosage: PropTypes.string,
    dosageUnit: PropTypes.string,
    warnings: PropTypes.string,
    doses: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        timestamp: PropTypes.string,
        dosage: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        status: PropTypes.string,
        overrideReason: PropTypes.string
      })
    ),
    settings: PropTypes.shape({
      defaultDosage: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.shape({
          amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          unit: PropTypes.string
        })
      ]),
      maxDailyDoses: PropTypes.number,
      minTimeBetweenDoses: PropTypes.number,
      trackSupply: PropTypes.bool,
      currentSupply: PropTypes.number,
      showTimeline: PropTypes.bool
    })
  }).isRequired,
  onRecordDose: PropTypes.func.isRequired,
  onUpdateSettings: PropTypes.func.isRequired
};

export default DrugTracker;