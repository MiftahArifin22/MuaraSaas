import Image from "next/image";

export function Brand() {
  return <Image className="brand" src="/logo-muara.webp" width={76} height={50} alt="MUARA" loading="eager" unoptimized />;
}
