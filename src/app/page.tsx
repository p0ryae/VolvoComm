"use client";

import { useEffect, useState } from "react";
import useTauriApi from "./hooks/useTauriApi";
import useEventListenApi from "./hooks/useEventListenApi";
import useScrollToBottom from "./hooks/useScrollToBottom";
import { Contact, Message } from "./types";
import Image from "next/image";
import ContactModal from "./components/ContactModal";

export default function VolvoComm() {
  const tauriApi = useTauriApi();
  const eventListenApi = useEventListenApi();

  const [personalUsername, setPersonalUsername] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactConn, setNewContactConn] = useState("");
  const [personalConn, setPersonalConn] = useState("");
  const [newContactImage, setNewContactImage] = useState("/default.png");
  const [messageValue, setMessageValue] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useScrollToBottom<HTMLDivElement>([messages]);
  const [messageHistories, setMessageHistories] = useState<{
    [contactId: string]: Message[];
  }>({});
  const [processedConns, setProcessedConns] = useState<Set<string>>(new Set());

  const handleCopy = () => {
    navigator.clipboard.writeText(personalConn).then(() => {});
  };

  useEffect(() => {
    if (tauriApi) {
      const setupInvoke = async () => {
        await tauriApi.invoke("get_ip_addr").then((ip: string) => {
          let ipSplit = ip.split("/");
          setPersonalConn(`${ipSplit[2]}/${ipSplit[4]}`);
        });
      };

      setupInvoke();
    }
  }, [tauriApi]);

  useEffect(() => {
    if (eventListenApi) {
      const setupListener = async () => {
        await eventListenApi("message_req", (event: any) => {
          const { id, ip } = event.payload;

          // let formatIp = ip.split("/");
          // const formattedIp = `${formatIp[2]}/${formatIp[4]}`;

          setContacts((prevContacts) => {
            const newContact: Contact = {
              id: prevContacts.length + 1,
              name: id,
              conn: "",
              image: "/default.png",
            };

            return [...prevContacts, newContact];
          });
        });
      };

      setupListener();
    }
  }, [eventListenApi, contacts]);

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

    const connString = contact.conn.split("/");
    const connKey = `/ip4/${connString[0]}/tcp/${connString[1]}`;

    if (!processedConns.has(connKey)) {
      tauriApi
        .invoke("connect_peer", { ip: connKey })
        .then(() => {
          setProcessedConns((prev) => new Set(prev).add(connKey));
        })
        .catch(console.error);
    }

    setMessages(messageHistories[contact.id] || []);
  };

  const resetSelectedContact = () => {
    setSelectedContact(undefined);
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
    if (messageValue.trim() == "") return;

    const newMessage: Message = {
      text: messageValue,
      sender: sender,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);

    if (!selectedContact) return;
    setMessageHistories((prevHistories) => {
      return {
        ...prevHistories,
        [selectedContact.id]: [
          ...(prevHistories[selectedContact.id] || []),
          newMessage,
        ],
      };
    });

    tauriApi.invoke("send_message", { message: messageValue, sender });

    if (sender === personalUsername) {
      setMessageValue("");
    }
  };

  useEffect(() => {
    if (eventListenApi) {
      const setupListener = async () => {
        const unsubscribe = await eventListenApi(
          "send_rec_message",
          (event: any) => {
            const { message, sender } = event.payload;

            if (!selectedContact) return;
            setMessageHistories((prevHistories) => {
              const updatedHistories = {
                ...prevHistories,
                [selectedContact?.id]: [
                  ...(prevHistories[selectedContact?.id] || []),
                  { text: message, sender: sender, timestamp: new Date() },
                ],
              };

              return updatedHistories;
            });

            setMessages((prevMessages) => [
              ...prevMessages,
              { text: message, sender: sender, timestamp: new Date() },
            ]);
          }
        );

        return unsubscribe;
      };

      const unsubscribePromise = setupListener();

      return () => {
        unsubscribePromise
          .then((unsubscribeFn) => {
            if (typeof unsubscribeFn === "function") {
              unsubscribeFn();
            }
          })
          .catch((error) => {
            console.error("Failed to unsubscribe:", error);
          });
      };
    }
  }, [eventListenApi, selectedContact]);

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
            <button
              onClick={resetSelectedContact}
              className="transition h-8 w-8 font-bold bg-true-purple text-white rounded-full hover:scale-110 flex items-center justify-center"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" />{" "}
                <polyline points="5 12 3 12 12 3 21 12 19 12" />{" "}
                <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />{" "}
                <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
              </svg>
            </button>
            <input
              type="text"
              value={personalUsername}
              onChange={handleUsernameChange}
              onKeyDown={handleUsernameChangeEnter}
              className="py-2 text-white font-semibold bg-transparent border-transparent focus:border-true-purple focus:outline-none flex-grow w-1/4 placeholder-gray-400/50 text-center"
              placeholder="Enter Username..."
            />
            <button
              onClick={openModal}
              className="transition h-8 w-8 font-bold bg-true-purple text-white rounded-full hover:scale-110 flex items-center justify-center"
            >
              <svg
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </button>
          </div>

          <div className="flex flex-col my-5 mx-4 h-3/3 overflow-y-auto">
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
                <span className="inline-block max-w-[150px] truncate">
                  {contact.name}
                </span>
              </button>
            ))}
          </div>
          <div className="relative text-center text-white mb-6 mt-auto group">
            <div className="transition-opacity duration-300 opacity-100 group-hover:opacity-0 text-gray-400/50">
              Hover for Connection Address
            </div>
            <div
              className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-gray-300/80`}
              onClick={handleCopy}
            >
              {personalConn}
            </div>
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
              <Image
                src={"./logo.png"}
                alt={`Profile Picture`}
                width={160}
                height={160}
                quality={100}
                priority
                className="shadow-md mb-6"
              />
              <h1 className="mb-4 text-4xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl">
                Welcome to VolvoComm.
              </h1>
              <h2 className="mb-4 text-xl font-semibold text-gray-300 md:text-2xl">
                A Secure and Real-Time Messaging Platform
              </h2>
              <p className="mb-6 text-lg font-normal text-gray-200 lg:text-xl">
                Choose or add a person from the left sidebar to get started. Setting a username is not mandatory.
              </p>
            </div>
          )}
        </div>
      </div>

      <ContactModal
        isModalOpen={isModalOpen}
        closeModal={closeModal}
        addContact={addContact}
        newContactImage={newContactImage}
        handleImageUpload={handleImageUpload}
        newContactName={newContactName}
        setNewContactName={setNewContactName}
        newContactConn={newContactConn}
        setNewContactConn={setNewContactConn}
      />
    </main>
  );
}
