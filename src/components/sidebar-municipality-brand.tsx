interface SidebarMunicipalityBrandProps {
  municipality?: { name?: string; brasao?: string; department_name?: string };
  defaultLabel: string;
}

export function SidebarMunicipalityBrand({ municipality, defaultLabel }: SidebarMunicipalityBrandProps) {
  const label = municipality?.name || defaultLabel;
  return (
    <>
      {municipality?.brasao && <img src={municipality.brasao} alt={`Brasão de ${label}`} className="brand-brasao" />}
      <div className="brand-text">
        <strong>{label}</strong>
        {municipality?.department_name && <span className="sidebar-brand-department">{municipality.department_name}</span>}
      </div>
    </>
  );
}
