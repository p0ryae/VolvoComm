export type Contact = {
  id: number;
  name: string;
  conn: string;
  image: string;
};

export interface Message {
  text: string;
  sender: string;
  timestamp: Date;
}
