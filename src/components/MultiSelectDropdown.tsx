import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput as RNTextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
  AccessibilityState,
  Image,
} from "react-native";
import { Text, Checkbox } from "react-native-paper";

export interface MultiSelectDropdownProps {
  label: string;
  items: { label: string; value: string; icon?: React.ReactNode | string }[]; // icon puede ser url de escudo
  selectedValues: string[];
  onValueChange?: (selected: string[]) => void; // <- ahora opcional
  onChange?: (selected: string[]) => void;      // <- alias compatible
  singleSelect?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  items,
  selectedValues,
  onValueChange,
  onChange,
  singleSelect = false,
  searchable = false,
  searchPlaceholder = "Buscar...",
}) => {
  const [visibleSearch, setVisibleSearch] = useState("");
  const todasSeleccionadas =
    !singleSelect && items.length > 0 && selectedValues.length === items.length;

  // Emite a ambas props para compatibilidad hacia atrás
  const emitChange = useCallback(
    (vals: string[]) => {
      if (onValueChange) onValueChange(vals);
      if (onChange) onChange(vals);
    },
    [onValueChange, onChange]
  );

  const filteredItems = searchable
    ? items.filter((i) =>
        i.label.toLowerCase().includes(visibleSearch.toLowerCase())
      )
    : items;

  const toggleSelect = (value: string) => {
    if (singleSelect) {
      emitChange([value]);
    } else {
      if (selectedValues.includes(value)) {
        emitChange(selectedValues.filter((v) => v !== value));
      } else {
        emitChange([...selectedValues, value]);
      }
    }
  };

  const toggleSeleccionTodas = () => {
    if (todasSeleccionadas) {
      emitChange([]);
    } else {
      emitChange(items.map((item) => item.value));
    }
  };

  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={styles.label}>{label}</Text>

      {searchable && (
        <RNTextInput
          placeholder={searchPlaceholder}
          value={visibleSearch}
          onChangeText={setVisibleSearch}
          style={[styles.searchInput, Platform.OS === 'web' && { color: '#000' }]}
          placeholderTextColor={Platform.OS === 'web' ? '#666' : undefined}
          accessibilityLabel={`Buscar ${label}`}
        />
      )}

      <ScrollView style={styles.dropdownContainer}>
        {!singleSelect && items.length > 0 && (
          <View
            style={styles.itemRow}
            accessible
            accessibilityLabel={todasSeleccionadas ? "Deseleccionar todas" : "Seleccionar todas"}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: todasSeleccionadas } as AccessibilityState}
          >
            <TouchableOpacity
              onPress={toggleSeleccionTodas}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Checkbox
                status={todasSeleccionadas ? "checked" : "unchecked"}
                onPress={toggleSeleccionTodas}
                color="#00AA00"
              />
            </TouchableOpacity>
            <Text style={styles.itemLabel}>Todas</Text>
          </View>
        )}

        {filteredItems.map((item) => (
          <View
            key={item.value}
            style={styles.itemRow}
            accessible
            accessibilityLabel={`Seleccionar ${item.label}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selectedValues.includes(item.value) } as AccessibilityState}
          >
            <TouchableOpacity
              onPress={() => toggleSelect(item.value)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Checkbox
                status={selectedValues.includes(item.value) ? "checked" : "unchecked"}
                onPress={() => toggleSelect(item.value)}
                color="#00AA00"
              />
            </TouchableOpacity>

            {/* Escudo del equipo si existe */}
            {item.icon && typeof item.icon === "string" ? (
              <Image
                source={{ uri: item.icon }}
                style={styles.teamIcon}
                resizeMode="contain"
              />
            ) : (
              item.icon && <View style={{ marginRight: 6 }}>{item.icon}</View>
            )}

            <Text style={styles.itemLabel}>{item.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default MultiSelectDropdown;

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    fontSize: Platform.OS === "web" ? 15 : 14,
    marginBottom: 6,
    color: "#ffffffff",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#bfbcbcff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dropdownContainer: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  itemLabel: {
    fontSize: 14,
    color: "#000000",
  },
  teamIcon: {
    width: 35,
    height: 35,
    marginRight: 50,
    borderRadius: 14,
  },
});
