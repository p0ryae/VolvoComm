import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center font-inter justify-between p-0">
      <div className="flex flex-row w-full h-screen">
        <div className="flex flex-col w-1/3 bg-black-500 p-4">
          <div className="flex flex-row items-center">
            <div className="bg-black-500">Contacts</div>
            <button className="transition h-8 w-8 bg-true-purple text-white rounded-full ml-auto hover:scale-110">
              +
            </button>
          </div>
          <div className="flex flex-col my-5 space-y-3">
            <button className="transition h-10 px-2 py-2 bg-true-purple text-white text-left rounded-xl flex items-center space-x-2 hover:cursor-default hover:scale-105">
              <div className="rounded-lg overflow-hidden">
                <Image
                  src="/person.png"
                  alt="Person Logo"
                  width={30}
                  height={30}
                  priority
                />
              </div>
              <span>Porya Dashtipour</span>
            </button>
          </div>
        </div>
        <div className="w-2/3 bg-true-purple p-4"></div>
      </div>
    </main>
  );
}
