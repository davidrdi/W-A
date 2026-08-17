import MapView from "react-native-maps";
import { StyleSheet } from "react-native";

const SPAIN_REGION = {
  latitude: 40.2,
  longitude: -3.7,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

export default function MapScreen() {
  return <MapView style={styles.map} initialRegion={SPAIN_REGION} />;
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
