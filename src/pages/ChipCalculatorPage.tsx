import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChipPreset, ChipEntry, ChipColor, CHIP_COLOR_MAP, CHIP_COLOR_LABELS } from '../types';
import { loadPresets, savePresets, generateId, deletePreset } from '../utils/storage';

const ALL_COLORS: ChipColor[] = [
  'white', 'red', 'blue', 'green', 'black', 'purple', 'yellow', 'pink', 'gray',
];

export function ChipCalculatorPage({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [newPresetName, setNewPresetName] = useState('');
  const [chipEntries, setChipEntries] = useState<ChipEntry[]>([
    { color: 'white', nominal: 5 },
    { color: 'red', nominal: 25 },
    { color: 'blue', nominal: 50 },
  ]);

  useEffect(() => {
    loadPresets().then(presets => {
      const valid = presets.filter(
        p => Array.isArray(p.chips) && p.chips.every(c => typeof c.color === 'string' && typeof c.nominal === 'number')
      );
      if (valid.length !== presets.length) {
        savePresets(valid);
      }
      setPresets(valid);
      if (valid.length > 0) {
        setSelectedPresetId(valid[0].id);
      }
    }).catch(() => {
      setPresets([]);
    });
  }, []);

  const addChipEntry = () => {
    const usedColors = new Set(chipEntries.map(e => e.color));
    const available = ALL_COLORS.find(c => !usedColors.has(c));
    if (!available) return;
    setChipEntries([...chipEntries, { color: available, nominal: 0 }]);
  };

  const removeChipEntry = (index: number) => {
    setChipEntries(chipEntries.filter((_, i) => i !== index));
  };

  const updateChipEntry = (index: number, field: keyof ChipEntry, value: string | number) => {
    setChipEntries(chipEntries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const usedColors = new Set(chipEntries.map(e => e.color));
  const availableColors = ALL_COLORS.filter(c => !usedColors.has(c));

  const handleSavePreset = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    if (chipEntries.length === 0) return;

    const newPreset: ChipPreset = {
      id: generateId(),
      name,
      chips: chipEntries.filter(e => e.nominal > 0),
    };

    if (newPreset.chips.length === 0) return;

    const updated = [...presets, newPreset];
    setPresets(updated);
    await savePresets(updated);
    setSelectedPresetId(newPreset.id);
    setShowForm(false);
    setNewPresetName('');
    setChipEntries([
      { color: 'white', nominal: 5 },
      { color: 'red', nominal: 25 },
      { color: 'blue', nominal: 50 },
    ]);
  };

  const handleDeletePreset = async (id: string) => {
    await deletePreset(id);
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    if (selectedPresetId === id) {
      setSelectedPresetId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const selectedPreset = presets.find(p =>
    p.id === selectedPresetId && Array.isArray(p.chips)
  );

  return (
    <div className={embedded ? undefined : 'page'}>
      {!embedded && <h1 className="page-title">🎯 Пресеты фишек</h1>}

      {/* Список пресетов */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Сохранённые</h3>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.1)', padding: '2px 10px', borderRadius: 12 }}>
            {presets.length}
          </span>
        </div>
        {presets.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, padding: 16 }}>
            Нет сохранённых пресетов
          </p>
        ) : (
          presets.map(preset => (
            <div
              key={preset.id}
              className="player-row"
              style={{ cursor: 'pointer', marginBottom: 4 }}
              onClick={() => setSelectedPresetId(preset.id)}
            >
              <div
                className={`preset-chip ${selectedPresetId === preset.id ? 'active' : ''}`}
                style={{ flex: 1, padding: '10px 14px', fontSize: 14 }}
              >
                {preset.name}
              </div>
              <button
                className="btn btn-danger btn-icon btn-small"
                style={{ width: 44, height: 44, fontSize: 22 }}
                onClick={e => { e.stopPropagation(); handleDeletePreset(preset.id); }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Детали выбранного пресета */}
      {selectedPreset && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>📋 {selectedPreset.name}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {selectedPreset.chips.map((chip, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', background: 'rgba(255,255,255,0.06)',
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span
                  style={{
                    display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
                    background: CHIP_COLOR_MAP[chip.color],
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{chip.nominal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Форма создания пресета */}
      {showForm ? (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>✨ Новый пресет</h3>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Название</label>
            <input
              className="input"
              type="text"
              placeholder="Мой пресет"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
            />
          </div>

          <label className="form-label" style={{ marginBottom: 8 }}>Фишки</label>
          {chipEntries.map((entry, index) => (
            <div key={index} className="player-row" style={{ marginBottom: 4 }}>
              <span
                style={{
                  display: 'inline-block', width: 24, height: 24, borderRadius: '50%',
                  background: CHIP_COLOR_MAP[entry.color],
                  border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0,
                }}
              />
              <select
                className="input"
                style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
                value={entry.color}
                onChange={e => updateChipEntry(index, 'color', e.target.value as ChipColor)}
              >
                {ALL_COLORS.filter(c => c === entry.color || !usedColors.has(c)).map(c => (
                  <option key={c} value={c}>{CHIP_COLOR_LABELS[c]}</option>
                ))}
              </select>
              <input
                className="preset-color-input"
                type="number"
                min="0"
                value={entry.nominal}
                onChange={e => updateChipEntry(index, 'nominal', parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <button
                className="btn btn-danger btn-icon btn-small"
                style={{ width: 44, height: 44, fontSize: 22 }}
                onClick={() => removeChipEntry(index)}
              >
                ×
              </button>
            </div>
          ))}

          {availableColors.length > 0 && (
            <button
              className="btn btn-secondary btn-small"
              style={{ marginTop: 12, width: 'auto' }}
              onClick={addChipEntry}
            >
              + Добавить фишку
            </button>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={handleSavePreset}>
              💾 Сохранить
            </button>
            <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary mt-16"
          onClick={() => setShowForm(true)}
        >
          ✨ Новый пресет
        </button>
      )}

      <div className={embedded ? 'mt-16' : 'spacer'} />
      {!embedded && (
        <button className="btn btn-secondary mt-16" onClick={() => navigate('/')}>
          На главную
        </button>
      )}
    </div>
  );
}
