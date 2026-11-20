import { Card } from "../../components/card";
import petHeroImage from "../../assets/caogato.avif";

interface HeroCardProps {
  variant?: "home" | "service" | "request";
  onGoToAdoption: () => void;
  onPublicRequest: () => void;
}

const actionStyle = "tw:inline-flex tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-solid tw:px-6 tw:py-3 tw:text-sm tw:whitespace-nowrap tw:motion-safe:transition-colors tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent";

const homeLayout = [
  "tw:mx-auto tw:mt-[clamp(16px,2vw,28px)] tw:w-[min(1760px,100%_-_24px)] tw:gap-5 tw:p-5",
  "tw:min-[521px]:w-[min(1760px,100%_-_clamp(28px,3.6vw,60px))] tw:min-[521px]:p-6",
  "tw:min-[721px]:min-h-[clamp(180px,20vw,240px)] tw:min-[721px]:justify-center",
  "tw:min-[721px]:px-[clamp(24px,4vw,60px)] tw:min-[721px]:py-[clamp(24px,3vw,40px)]",
].join(" ");

const sidebarLayout = "tw:h-full tw:w-full tw:p-[clamp(24px,2.4vw,36px)] tw:max-[980px]:min-h-[280px] tw:max-[980px]:gap-5";
const homeArt = [
  "tw:h-[clamp(150px,46vw,220px)] tw:w-full tw:rounded-[calc(var(--radius-lg)-4px)] tw:object-[center_52%]",
  "tw:min-[721px]:absolute tw:min-[721px]:inset-y-0 tw:min-[721px]:right-0 tw:min-[721px]:h-full tw:min-[721px]:w-[46%] tw:min-[721px]:rounded-none",
  "tw:min-[721px]:object-[center_36%] tw:min-[721px]:[mask-image:linear-gradient(to_right,transparent,black_38%)]",
].join(" ");
const sidebarArt = [
  "tw:h-[clamp(150px,38vw,220px)] tw:w-full tw:rounded-[calc(var(--radius-lg)-4px)] tw:object-[center_52%]",
  "tw:min-[981px]:absolute tw:min-[981px]:inset-x-0 tw:min-[981px]:bottom-0 tw:min-[981px]:rounded-none tw:min-[981px]:object-[center_36%]",
  "tw:min-[981px]:[mask-image:linear-gradient(to_bottom,transparent,black_38%)]",
].join(" ");

export function HeroCard({ variant = "home", onGoToAdoption, onPublicRequest }: HeroCardProps) {
  const home = variant === "home";
  const artHeight = variant === "request"
    ? "tw:min-[981px]:h-[clamp(0px,100%_-_315px,58%)]"
    : "tw:min-[981px]:h-[58%]";

  return (
    <Card as="section" tone="page" className={`tw:relative tw:isolate tw:flex tw:min-w-0 tw:flex-col tw:overflow-hidden ${home ? homeLayout : sidebarLayout}`}>
      <div className={`tw:relative tw:z-10 tw:flex tw:min-w-0 tw:flex-col tw:gap-3.5 ${home ? "tw:min-[721px]:max-w-[min(57%,720px)]" : "tw:max-w-[480px]"}`}>
        <h1 className={`tw:m-0 tw:leading-tight tw:font-bold tw:tracking-tight tw:text-ui-ink ${home ? "tw:text-[clamp(1.5rem,3.2vw,2.1rem)]" : "tw:text-[clamp(1.55rem,2.4vw,2.3rem)]"}`}>
          Cuidado e proteção para quem não tem voz
        </h1>
        <p className="tw:m-0 tw:text-[0.92rem] tw:leading-relaxed tw:text-ui-text">
          Castração gratuita, adoção responsável e bem-estar animal - digital e acessível.
        </p>
        <div className={`tw:mt-1.5 tw:flex tw:flex-wrap tw:gap-3 ${home ? "tw:max-[520px]:flex-col" : "tw:max-w-[260px] tw:flex-col"}`}>
          <button type="button" className={`${actionStyle} tw:border-ui-accent tw:bg-ui-accent tw:text-white tw:hover:border-ui-accent-strong tw:hover:bg-ui-accent-strong`} onClick={onGoToAdoption}>
            Quero adotar
          </button>
          <button type="button" className={`${actionStyle} tw:border-ui-ink tw:bg-transparent tw:text-ui-ink tw:hover:bg-ui-accent-soft`} onClick={onPublicRequest}>
            Agendar castração
          </button>
        </div>
      </div>
      <img src={petHeroImage} alt="" className={`tw:pointer-events-none tw:block tw:min-w-0 tw:object-cover ${home ? homeArt : `${sidebarArt} ${artHeight}`}`} />
    </Card>
  );
}
