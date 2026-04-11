import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChipPreset, ChipEntry, ChipColor } from '../types';
import { loadPresets, savePresets, generateId, deletePreset } from '../utils/storage';
import { DEFAULT_CHIP_ENTRIES } from '../utils/constants';
import { CHIP_COLOR_MAP } from '../types';

const ALL_COLORS: ChipColor[] = [
  'white', 'red', 'blue', 'green', 'black', 'purple', 'yellow', 'pink', 'gray',
];

export function ChipCalculatorPage({ embedded }: { embedded?: boolean }) {
  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [chipEntries, setChipEntries] = useState<ChipEntry[]>(DEFAULT_CHIP_ENTRIES);

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
    }).catch(() => setPresets([]));
  }, []);

  const availableColors = useMemo(
    () => ALL_COLORS.filter(c => !chipEntries.some(e => e.color === c)),
    [chipEntries],
  );

  const addChipEntry = useCallback(() => {
    const available = ALL_COLORS.filter(c => !chipEntries.some(e => e.color === c));
    if (available.length === 0) return;
    setChipEntries(prev => [...prev, { color: available[0], nominal: 0 }]);
  }, [chipEntries]);

  const removeChipEntry = useCallback((index: number) => {
    setChipEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateChipEntry = useCallback((index: number, field: keyof ChipEntry, value: string | number) => {
    setChipEntries(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ));
  }, []);

  const handleSavePreset = useCallback(async () => {
    const name = newPresetName.trim();
    if (!name || chipEntries.length === 0) return;

    const validChips = chipEntries.filter(e => e.nominal > 0);
    if (validChips.length === 0) return;

    const newPreset: ChipPreset = {
      id: generateId(),
      name,
      chips: validChips,
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    await savePresets(updated);
    setSelectedPresetId(newPreset.id);
    setShowForm(false);
    setNewPresetName('');
    setChipEntries(DEFAULT_CHIP_ENTRIES);
  }, [newPresetName, chipEntries, presets]);

  const handleDeletePreset = useCallback(async (id: string) => {
    await deletePreset(id);
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    if (selectedPresetId === id) {
      setSelectedPresetId(updated.length > 0 ? updated[0].id : null);
    }
  }, [presets, selectedPresetId]);

  const selectedPreset = useMemo(
    () => presets.find(p => p.id === selectedPresetId && Array.isArray(p.chips)),
    [presets, selectedPresetId],
  );

  return (
    <div className={embedded ? undefined : 'page'}>
      {!embedded && <h1 className="page-title">🎯 Пресеты фишек</h1>}

      <PresetList
        presets={presets}
        selectedId={selectedPresetId}
        onSelect={setSelectedPresetId}
        onDelete={handleDeletePreset}
      />

      {selectedPreset && (
        <PresetDetail preset={selectedPreset} />
      )}

      {showForm ? (
        <PresetForm
          name={newPresetName}
          setName={setNewPresetName}
          chipEntries={chipEntries}
          availableColors={availableColors}
          onAddEntry={addChipEntry}
          onRemoveEntry={removeChipEntry}
          onUpdateEntry={updateChipEntry}
          onSave={handleSavePreset}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button className="btn btn-secondary mt-16" onClick={() => setShowForm(true)}>
          ✨ Новый пресет
        </button>
      )}

      <div className={embedded ? 'mt-16' : 'spacer'} />
      {!embedded && (
        <button className="btn btn-secondary mt-16" onClick={() => window.history.back()}>
          ← Назад
        </button>
      )}
    </div>
  );
}

// === Sub-components ===

function PresetList({ presets, selectedId, onSelect, onDelete }: {
  presets: ChipPreset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Сохранённые</h3>
        <span className="badge">{presets.length}</span>
      </div>
      {presets.length === 0 ? (
        <p className="empty-text">Нет сохранённых пресетов</p>
      ) : (
        presets.map(preset => (
          <div key={preset.id} className="player-row">
            <div
              className={`preset-chip ${selectedId === preset.id ? 'active' : ''}`}
              onClick={() => onSelect(preset.id)}
            >
              {preset.name}
            </div>
            <button
              className="btn btn-danger btn-icon btn-small"
              onClick={e => { e.stopPropagation(); onDelete(preset.id); }}
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function PresetDetail({ preset }: { preset: ChipPreset }) {
  return (
    <div className="card">
      <h3 className="mb-12">📋 {preset.name}</h3>
      <div className="chip-tags">
        {preset.chips.map((chip, i) => (
          <div key={i} className="chip-tag">
            <span
              className="chip-dot"
              style={{ background: CHIP_COLOR_MAP[chip.color] }}
            />
            <span className="font-semibold">{chip.nominal}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PresetForm({
  name, setName, chipEntries, availableColors,
  onAddEntry, onRemoveEntry, onUpdateEntry, onSave, onCancel,
}: {
  name: string; setName: (v: string) => void;
  chipEntries: ChipEntry[];
  availableColors: ChipColor[];
  onAddEntry: () => void;
  onRemoveEntry: (i: number) => void;
  onUpdateEntry: (i: number, field: keyof ChipEntry, value: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card">
      <h3 className="mb-16">✨ Новый пресет</h3>
      <div className="form-group">
        <label className="form-label">Название</label>
        <input
          className="input"
          type="text"
          placeholder="Мой пресет"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <label className="form-label">Фишки</label>
      {chipEntries.map((entry, index) => (
        <ChipEntryRow
          key={index}
          entry={entry}
          index={index}
          onUpdate={onUpdateEntry}
          onRemove={onRemoveEntry}
        />
      ))}

      {availableColors.length > 0 && (
        <button className="btn btn-secondary btn-small mt-12" onClick={onAddEntry}>
          + Добавить фишку
        </button>
      )}

      <div className="form-actions">
        <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={onSave}>
          💾 Сохранить
        </button>
        <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function ChipEntryRow({ entry, index, onUpdate, onRemove }: {
  entry: ChipEntry;
  index: number;
  onUpdate: (i: number, field: keyof ChipEntry, value: string | number) => void;
  onRemove: (i: number) => void;
}) {
  const cycleColor = () => {
    const currentIdx = ALL_COLORS.indexOf(entry.color);
    const nextIdx = (currentIdx + 1) % ALL_COLORS.length;
    onUpdate(index, 'color', ALL_COLORS[nextIdx]);
  };

  return (
    <div className="chip-entry-row">
      <button
        className="chip-color-btn"
        style={{ background: CHIP_COLOR_MAP[entry.color] }}
        onClick={cycleColor}
        title="Нажмите для смены цвета"
      />
      <input
        className="chip-nominal-input"
        type="number"
        min="0"
        value={entry.nominal || ''}
        onChange={e => onUpdate(index, 'nominal', parseInt(e.target.value) || 0)}
        placeholder="0"
      />
      <button
        className="chip-remove-btn"
        onClick={() => onRemove(index)}
      >
        ×
      </button>
    </div>
  );
}
