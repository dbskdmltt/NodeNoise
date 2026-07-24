export type NodeCategory = "human" | "nonhuman";

export interface GraphNode {
  id: string;
  label: string;
  category: NodeCategory;
  radius: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  highlighted?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

export interface LetterEntry {
  id: string;
  text: string;
  censoredText: string;
  createdAt: string;
}
