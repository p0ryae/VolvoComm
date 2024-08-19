"use client";

import { useEffect, useState } from "react";
import { CSSTransition } from "react-transition-group";
import useTauriApi from "./hooks/useTauriApi";
import useEventListenApi from "./hooks/useEventListenApi";
import useScrollToBottom from "./hooks/useScrollToBottom";
import { Contact, Message } from "./types";
import Image from "next/image";
import styles from "./page.module.css";

export default function VolvoComm() {
  const tauriApi = useTauriApi();
  const eventListenApi = useEventListenApi();

  const [personalUsername, setPersonalUsername] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactConn, setNewContactConn] = useState("");
  const [newContactImage, setNewContactImage] = useState("/default.png");
  const [messageValue, setMessageValue] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useScrollToBottom<HTMLDivElement>([messages]);
  const [messageHistories, setMessageHistories] = useState<{
    [contactId: string]: Message[];
  }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageValue(e.target.value);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonalUsername(e.target.value);
  };

  const handleUsernameChangeEnter = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const target = e.target as HTMLInputElement;
      setPersonalUsername(target.value);
    }
  };

  const selectContact = (contact: Contact) => {
    if (selectedContact === contact) {
      return;
    }

    setSelectedContact(contact);
    tauriApi.invoke("connect_peer", { ip: contact.conn }).catch(console.error);

    setMessages(messageHistories[contact.id] || []);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewContactName("");
    setNewContactConn("");
    setNewContactImage("/default.png");
  };

  const handleSubmitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(messageValue, personalUsername);
    }
  };

  const handleSubmit = (messageValue: string, sender: string) => {
    if (selectedContact && messageValue.trim() !== "") {
      const newMessage: Message = {
        text: messageValue,
        sender: sender,
        timestamp: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);

      setMessageHistories((prevHistories) => {
        const updatedHistories = {
          ...prevHistories,
          [selectedContact.id]: [
            ...(prevHistories[selectedContact.id] || []),
            newMessage,
          ],
        };

        return updatedHistories;
      });

      if (sender === personalUsername) {
        tauriApi.invoke("send_message", { message: messageValue });
        setMessageValue("");
      }
    }
  };

  useEffect(() => {
    if (eventListenApi) {
      const unsubscribe = eventListenApi("send_rec_message", (event: any) => {
        handleSubmit(event.payload.message, "other");
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [eventListenApi]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewContactImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addContact = () => {
    if (newContactName.trim() !== "") {
      const newContact: Contact = {
        id: contacts.length + 1,
        name: newContactName,
        conn: newContactConn,
        image: newContactImage,
      };
      setContacts([...contacts, newContact]);
      closeModal();
    }
  };

  return (
    <main className="select-none flex min-h-screen flex-col text-black items-center font-inter font-medium justify-between p-0">
      <div className="flex flex-row w-full h-screen">
        <div className="flex flex-col w-1/3 bg-zinc-800">
          <div className="flex flex-row items-center w-full p-4">
            <input
              type="text"
              value={personalUsername}
              onChange={handleUsernameChange}
              onKeyDown={handleUsernameChangeEnter}
              className="font-bold py-2 text-white bg-transparent border-transparent focus:border-true-purple focus:outline-none flex-grow w-1/4"
              placeholder="Enter your username"
            />
            <button
              onClick={openModal}
              className="transition h-8 w-8 font-bold bg-true-purple text-white rounded-full hover:scale-110"
            >
              +
            </button>
          </div>

          <div className="flex flex-col my-5 mx-4">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => selectContact(contact)}
                className={`transition h-14 px-4 py-8 mb-2 ${
                  selectedContact === contact
                    ? "bg-true-purple/80"
                    : "bg-true-purple/10"
                } text-white text-left shadow-lg border-true-purple rounded-2xl flex items-center space-x-2 hover:cursor-default`}
              >
                <div className="rounded-full overflow-hidden">
                  <Image
                    src={contact.image}
                    alt={`Profile Picture`}
                    width={35}
                    height={35}
                    quality={100}
                    priority
                    style={{
                      objectFit: "cover",
                      height: "35px",
                      width: "35px",
                    }}
                    className="shadow-md"
                  />
                </div>
                <span>{contact.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="w-2/3 bg-zinc-900 p-4 flex flex-col justify-center items-center">
          {contacts.length !== 0 && selectedContact ? (
            <div className="flex flex-col h-full w-full">
              <div className="flex-grow p-4 rounded-md overflow-y-auto w-full">
                {messages.length === 0 ? (
                  <div className="flex text-white flex-col space-y-2 h-full justify-center items-center">
                    <div className="text-gray-400/50 text-xl">
                      No messages to show...
                    </div>
                  </div>
                ) : (
                  <div
                    id="chatlog"
                    className="flex text-white flex-col space-y-2 overflow-y-auto"
                  >
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.sender === personalUsername
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`message-bubble ${
                            message.sender === personalUsername
                              ? "bg-true-purple"
                              : "bg-gray-600"
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="flex items-center mt-4 w-full">
                <input
                  type="text"
                  placeholder="VolvoComm Message..."
                  value={messageValue}
                  onChange={handleChange}
                  onKeyDown={handleSubmitKeyDown}
                  className="flex-grow px-3 py-2 text-white bg-transparent rounded-full border-2 border-transparent focus:border-true-purple focus:outline-none"
                />
                {messageValue && (
                  <button
                    className="ml-2 px-4 py-2 bg-true-purple text-white rounded-full font-bold transition"
                    onClick={() => handleSubmit(messageValue, personalUsername)}
                  >
                    ↑
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center text-center py-12 px-6 rounded-lg">
              <h1 className="mb-4 text-4xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl">
                Welcome to VolvoComm.
              </h1>
              <h2 className="mb-4 text-xl font-semibold text-gray-300 md:text-2xl">
                A Secure and Real-Time Chat Interface
              </h2>
              <p className="mb-6 text-lg font-normal text-gray-200 lg:text-xl">
                Choose or add a person from the left sidebar to get started.
                Make sure to set a username.
              </p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="absolute inset-0 text-black flex items-center justify-center bg-black bg-opacity-60"></div>
      )}

      <CSSTransition
        in={isModalOpen}
        timeout={300}
        classNames={{
          enter: styles.modalEnter,
          enterActive: styles.modalEnterActive,
          exit: styles.modalExit,
          exitActive: styles.modalExitActive,
        }}
        unmountOnExit
      >
        <div className="fixed inset-0 text-white flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Add New Contact</h2>
            <div className="flex flex-row">
              <div className="flex items-center mb-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer border-2 border-gray-500 rounded-full w-16 h-16 flex items-center justify-center"
                >
                  {newContactImage ? (
                    <img
                      src={newContactImage}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400">Add Image</span>
                  )}
                </label>
              </div>
              <div className="flex flex-col mx-4 text-white">
                <input
                  type="text"
                  placeholder="Contact name..."
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full mb-2 px-3 py-2 border border-gray-500 rounded-xl bg-transparent border-2 border-transparent focus:border-true-purple focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Connection address..."
                  value={newContactConn}
                  onChange={(e) => setNewContactConn(e.target.value)}
                  className="w-full mb-4 px-3 py-2  border border-gray-500 rounded-xl bg-transparent border-2 border-transparent focus:border-true-purple focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={closeModal}
                className="transition px-4 py-2 text-black bg-gray-300 rounded-lg hover:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={addContact}
                className="transition px-4 py-2 text-white bg-true-purple rounded-lg hover:scale-95"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </CSSTransition>
    </main>
  );
}
