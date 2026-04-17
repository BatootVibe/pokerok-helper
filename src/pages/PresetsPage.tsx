import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChipPreset, ChipEntry, ChipColor, CHIP_COLOR_MAP } from '../types';
import { loadPresets, savePresets, deletePreset, getUserProfile } from '../utils/storage';
import { generateId } from '../utils/id';
import { DEFAULT_CHIP_ENTRIES } from '../utils/constants';
import { HeaderBack } from '../components/HeaderBack';

const ALL_COLORS: ChipColor[] = [
  'white', 'red', 'blue', 'green', 'black', 'purple', 'yellow', 'pink', 'gray',
];

export function PresetsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const fromCreate = location.state?.fromCreate === true;

  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [chipEntries, setChipEntries] = useState<ChipEntry[]>(DEFAULT_CHIP_ENTRIES);
  const [isDuplicateName, setIsDuplicateName] = useState(false);

  // Auth state
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const currentTgId = tgUser ? String(tgUser.id) : null;
  const [isBound, setIsBound] = useState(false);

  useEffect(() => {
    if (currentTgId) {
      getUserProfile().then(profile => setIsBound(!!profile));
    }
  }, [currentTgId]);

  useEffect(() => {
    if (!newPresetName.trim()) {
      setIsDuplicateName(false);
      return;
    }
    const isDup = presets.some(p =>
      p.name.toLowerCase() === newPresetName.trim().toLowerCase() && p.id !== editingPresetId
    );
    setIsDuplicateName(isDup);
  }, [newPresetName, presets, editingPresetId]);

  useEffect(() => {
    loadPresets().then(presets => {
      const valid = presets.filter(
        p => Array.isArray(p.chips) && p.chips.every(c => typeof c.color === 'string' && typeof c.nominal === 'number')
      );
      if (valid.length !== presets.length) {
        savePresets(valid);
      }
      setPresets(valid);
    }).catch(() => setPresets([]));
  }, []);

  const addChipEntry = useCallback(() => {
    const available = ALL_COLORS.filter(c => !chipEntries.some(e => e.color === c));
    if (available.length === 0) return;
    setChipEntries(prev => [...prev, { color: available[0], nominal: 0 }]);
  }, [chipEntries]);

  const updateChipEntry = useCallback((index: number, field: keyof ChipEntry, value: string | number) => {
    setChipEntries(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ));
  }, []);

  const changeChipColor = useCallback((index: number) => {
    setChipEntries(prev => {
      const usedColors = new Set(prev.map(e => e.color));
      const currentIdx = ALL_COLORS.indexOf(prev[index].color);
      for (let i = 1; i <= ALL_COLORS.length; i++) {
        const nextIdx = (currentIdx + i) % ALL_COLORS.length;
        if (!usedColors.has(ALL_COLORS[nextIdx])) {
          const updated = [...prev];
          updated[index] = { ...updated[index], color: ALL_COLORS[nextIdx] };
          return updated;
        }
      }
      return prev;
    });
  }, []);

  const openEdit = useCallback((preset: ChipPreset) => {
    setEditingPresetId(preset.id);
    setNewPresetName(preset.name);
    setChipEntries(preset.chips.map(c => ({ ...c })));
    setShowForm(true);
  }, []);

  const openNew = useCallback(() => {
    setEditingPresetId(null);
    setNewPresetName('');
    setChipEntries(DEFAULT_CHIP_ENTRIES);
    setShowForm(true);
  }, []);

  const handleSavePreset = useCallback(async () => {
    const name = newPresetName.trim();
    if (!name || chipEntries.length === 0) return;

    const validChips = chipEntries.filter(e => e.nominal > 0);
    if (validChips.length === 0 || isDuplicateName) return;

    const newPreset: ChipPreset = {
      id: editingPresetId || generateId(),
      name,
      chips: validChips,
      isTemporary: !isBound,
    };

    try {
      let updated: ChipPreset[];
      if (editingPresetId) {
        updated = presets.map(p => p.id === editingPresetId ? newPreset : p);
      } else {
        updated = [...presets, newPreset];
      }

      await savePresets(updated);
      setPresets(updated);
      setShowForm(false);
      setEditingPresetId(null);
      setNewPresetName('');
      setChipEntries(DEFAULT_CHIP_ENTRIES);

      // Если пришли со страницы создания игры и создали пресет — вернуться с ID нового пресета
      if (fromCreate && !editingPresetId) {
        sessionStorage.setItem('pendingPresetId', newPreset.id);
        navigate(-1);
      }
    } catch (err) {
      console.error('Failed to save preset:', err);
      alert('Не удалось сохранить пресет на сервер. Попробуйте ещё раз.');
    }
  }, [newPresetName, chipEntries, presets, editingPresetId, fromCreate, navigate]);

  const handleDeletePreset = useCallback(async (id: string) => {
    try {
      await deletePreset(id);
      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
    } catch (err) {
      console.error('Failed to delete preset:', err);
      alert('Не удалось удалить пресет с сервера.');
    }
  }, [presets]);

  return (
    <div className="page">
      <HeaderBack title="Пресеты фишек" />

      {!showForm && (
        <>
          <PresetList presets={presets} onEdit={isBound ? openEdit : () => {}} isBound={isBound} />
          {isBound && presets.length > 0 && (
            <p className="page-hint text-center">Удерживайте карточку 2 сек для редактирования</p>
          )}
        </>
      )}

      {showForm ? (
        <PresetForm
          name={newPresetName}
          setName={setNewPresetName}
          chipEntries={chipEntries}
          isEditing={editingPresetId !== null}
          isDuplicateName={isDuplicateName}
          isTemporary={!isBound && !editingPresetId}
          onChangeColor={changeChipColor}
          onUpdateNominal={(i, v) => updateChipEntry(i, 'nominal', v)}
          onRemove={(i) => setChipEntries(prev => prev.filter((_, idx) => idx !== i))}
          onAdd={addChipEntry}
          onSave={handleSavePreset}
          onRemovePreset={editingPresetId ? () => {
            handleDeletePreset(editingPresetId);
            setShowForm(false);
            setEditingPresetId(null);
          } : undefined}
          onCancel={() => {
            setShowForm(false);
            setEditingPresetId(null);
          }}
          canAddMore={chipEntries.length < ALL_COLORS.length}
        />
      ) : (
        <div className="fixed-actions">
          <button className="btn btn-secondary" onClick={openNew}>
            ✨ Новый пресет
          </button>
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

function PresetList({ presets, onEdit, isBound }: {
  presets: ChipPreset[];
  onEdit: (preset: ChipPreset) => void;
  isBound: boolean;
}) {
  if (presets.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🎨</div>
        Пока нет сохранённых пресетов
      </div>
    );
  }

  return (
    <div className="preset-list">
      {presets.map(preset => (
        <PresetListItem
          key={preset.id}
          preset={preset}
          onEdit={() => onEdit(preset)}
          canEdit={isBound && !preset.isTemporary}
        />
      ))}
    </div>
  );
}

function PresetListItem({ preset, onEdit, canEdit }: {
  preset: ChipPreset;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const holdTimerRef = useRef<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const EDIT_HOLD_DURATION = 2000;

  const startHold = () => {
    if (!canEdit) return;
    setIsHolding(true);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setIsHolding(false);
      onEdit();
    }, EDIT_HOLD_DURATION);
  };

  const releaseHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const sortedChips = preset.chips.slice().sort((a, b) => a.nominal - b.nominal);

  return (
    <div
      className={`preset-card ${isHolding ? 'holding' : ''}`}
      onMouseDown={startHold}
      onMouseUp={releaseHold}
      onMouseLeave={releaseHold}
      onTouchStart={startHold}
      onTouchEnd={releaseHold}
      onTouchCancel={releaseHold}
    >
      <div className="preset-card-header">
        <div className="preset-card-title">
          <span className="preset-card-name">{preset.name}</span>
          {preset.isTemporary && <span className="badge badge-temp">Временный</span>}
        </div>
        <div className="preset-card-chips">
          {sortedChips.map((chip, i) => {
            const isLight = ['white', 'yellow', 'pink'].includes(chip.color);
            return (
              <span key={i} className={`preset-chip-display ${isLight ? 'light-chip' : ''}`} style={{ background: CHIP_COLOR_MAP[chip.color] }}>
                <span className="preset-chip-nominal">{chip.nominal}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PresetForm({
  name, setName, chipEntries, isEditing, isDuplicateName, isTemporary,
  onChangeColor, onUpdateNominal, onRemove, onAdd, onSave, onRemovePreset, onCancel,
  canAddMore,
}: {
  name: string; setName: (v: string) => void;
  chipEntries: ChipEntry[];
  isEditing: boolean;
  isDuplicateName: boolean;
  isTemporary: boolean;
  onChangeColor: (i: number) => void;
  onUpdateNominal: (i: number, v: number) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  onSave: () => void;
  onRemovePreset?: () => void;
  onCancel: () => void;
  canAddMore: boolean;
}) {
  return (
    <div className="card">
      <h3 className="mb-16">{isEditing ? '✏️ Редактировать пресет' : isTemporary ? '⚡ Временный пресет' : '✨ Новый пресет'}</h3>
      {isTemporary && <p className="page-hint mb-8">Пресет будет удалён после завершения игры</p>}
      <div className="form-group">
        <label className="form-label">Название</label>
        <input
          className="input"
          type="text"
          placeholder="Мой пресет"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        {isDuplicateName && (
          <p className="error-text mt-4">Пресет с таким названием уже существует</p>
        )}
      </div>

      <label className="form-label chips-label">Фишки</label>
      {chipEntries.map((entry, index) => (
        <ChipEntryRow
          key={index}
          entry={entry}
          onChangeColor={() => onChangeColor(index)}
          onUpdateNominal={v => onUpdateNominal(index, v)}
          onRemove={() => onRemove(index)}
        />
      ))}

      {canAddMore && (
        <button className="btn btn-secondary btn-small mt-12" onClick={onAdd}>
          + Добавить фишку
        </button>
      )}

      <div className="form-actions">
        <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={onSave} disabled={isDuplicateName}>
          💾 {isEditing ? 'Сохранить' : 'Создать'}
        </button>
        <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={onCancel}>
          Отмена
        </button>
        {isEditing && (
          <button className="btn btn-danger btn-small" onClick={() => onRemovePreset?.()}>
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

function ChipEntryRow({ entry, onChangeColor, onUpdateNominal, onRemove }: {
  entry: ChipEntry;
  onChangeColor: () => void;
  onUpdateNominal: (v: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="chip-entry-row">
      <button
        className="chip-rect-btn"
        style={{ background: CHIP_COLOR_MAP[entry.color] }}
        onClick={onChangeColor}
        title="Нажмите для смены цвета"
      />
      <input
        className="chip-nominal-input"
        type="number"
        min="0"
        value={entry.nominal || ''}
        onChange={e => onUpdateNominal(parseInt(e.target.value) || 0)}
        placeholder="Номинал"
      />
      <button
        className="chip-remove-btn"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
