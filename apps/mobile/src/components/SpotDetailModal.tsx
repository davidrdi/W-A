import { useEffect, useState } from "react";
import type { ChatMessage, ScoredSpot, SpotExplanation } from "@w-a/shared";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { askFollowUp, explainSpot } from "../api";
import { SCORE_BAND_COLOR } from "../mapIcons";

interface Props {
  spot: ScoredSpot | null;
  distanceLabel?: string;
  onClose: () => void;
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export function SpotDetailModal({ spot, distanceLabel, onClose }: Props) {
  const [explanation, setExplanation] = useState<SpotExplanation | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!spot) return;
    setExplanation(null);
    setMessages([]);
    setQuestion("");
    setLoadState({ kind: "loading" });

    explainSpot(spot)
      .then((result) => {
        setExplanation(result);
        setLoadState({ kind: "ready" });
      })
      .catch((error) => {
        setLoadState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo cargar" });
      });
  }, [spot]);

  const send = async () => {
    const trimmed = question.trim();
    if (!trimmed || !explanation || asking) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setAsking(true);
    try {
      const { answer } = await askFollowUp(explanation.groundingPayload, messages, trimmed);
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: error instanceof Error ? error.message : "No se pudo responder." },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Modal visible={spot !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={40}
        >
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{spot?.name}</Text>
              {distanceLabel && <Text style={styles.distance}>A {distanceLabel}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Cerrar</Text>
            </Pressable>
          </View>

          {loadState.kind === "loading" && (
            <View style={styles.centered}>
              <ActivityIndicator />
            </View>
          )}

          {loadState.kind === "error" && (
            <View style={styles.centered}>
              <Text style={styles.error}>{loadState.message}</Text>
            </View>
          )}

          {loadState.kind === "ready" && explanation && (
            <>
              <View style={styles.scoreRow}>
                <View style={[styles.scoreBadge, { backgroundColor: SCORE_BAND_COLOR[explanation.scoreBand] }]}>
                  <Text style={styles.scoreBadgeText}>{explanation.score}</Text>
                </View>
                <Text style={styles.headline}>{explanation.headline}</Text>
              </View>
              <Text style={styles.reasoning}>{explanation.reasoning}</Text>
              {explanation.cautions.map((caution) => (
                <Text key={caution} style={styles.caution}>
                  ⚠ {caution}
                </Text>
              ))}

              <FlatList
                style={styles.chat}
                data={messages}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={item.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>
                      {item.content}
                    </Text>
                  </View>
                )}
              />

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Pregunta algo más sobre esta zona…"
                  onSubmitEditing={send}
                  editable={!asking}
                />
                <Pressable style={styles.sendButton} onPress={send} disabled={asking}>
                  {asking ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>▶</Text>}
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "80%",
    minHeight: "45%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleBlock: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  distance: {
    fontSize: 13,
    color: "#52625A",
  },
  close: {
    color: "#235C4D",
    fontWeight: "600",
  },
  centered: {
    paddingVertical: 32,
    alignItems: "center",
  },
  error: {
    color: "#B4432E",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  scoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  headline: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  reasoning: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  caution: {
    fontSize: 13,
    color: "#B8862B",
    marginTop: 2,
  },
  chat: {
    flexGrow: 0,
    marginTop: 12,
    marginBottom: 8,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    maxWidth: "85%",
  },
  bubbleUser: {
    backgroundColor: "#235C4D",
    alignSelf: "flex-end",
  },
  bubbleAssistant: {
    backgroundColor: "#F2F4F1",
    alignSelf: "flex-start",
  },
  bubbleUserText: {
    color: "#fff",
  },
  bubbleAssistantText: {
    color: "#17211A",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D3DCCE",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#235C4D",
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#fff",
    fontWeight: "700",
  },
});
