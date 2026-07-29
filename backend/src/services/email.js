export async function sendResetCodeEmail({ toEmail, toName, code }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    return { status: "skipped", reason: "Credenciais de e-mail incompletas" };
  }

  const body = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: { to_email: toEmail, to_name: toName || toEmail, codigo_recuperacao: code },
  };
  if (privateKey) body.accessToken = privateKey;

  let response;
  try {
    response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[Email] Falha ao enviar código de reset:", err.message);
    return { status: "failed", reason: err.message };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[Email] Falha ao enviar código de reset:", response.status, text);
    return { status: "failed", reason: text || response.statusText };
  }

  return { status: "sent" };
}
