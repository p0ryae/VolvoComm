import React from "react";
import { CSSTransition } from "react-transition-group";
import styles from "../styles/transition.module.css";
import Image from "next/image";

interface ContactModalProps {
  isModalOpen: boolean;
  closeModal: () => void;
  addContact: () => void;
  newContactImage: string | null;
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  newContactName: string;
  setNewContactName: (name: string) => void;
  newContactConn: string;
  setNewContactConn: (conn: string) => void;
}

const ContactModal: React.FC<ContactModalProps> = ({
  isModalOpen,
  closeModal,
  addContact,
  newContactImage,
  handleImageUpload,
  newContactName,
  setNewContactName,
  newContactConn,
  setNewContactConn,
}) => {
  return (
    <>
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
                  className="cursor-pointer border-gray-500 rounded-full w-20 h-20 ml-2 flex items-center justify-center border-4"
                >
                  {newContactImage ? (
                    <Image
                      src={newContactImage}
                      alt="Profile"
                      width={20}
                      height={20}
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
                  className="w-full mb-4 px-3 py-2 border border-gray-500 rounded-xl bg-transparent border-2 border-transparent focus:border-true-purple focus:outline-none"
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
    </>
  );
};

export default ContactModal;
