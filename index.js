const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER, // Usar la variable de entorno
    pass: process.env.EMAIL_PASS    // Usar la variable de entorno
  }
});

const sendEmail = (message, subject) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: subject,
    text: message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Email enviado: ' + info.response);
  });
};

let lastEmailSentTime = null; // Para rastrear el tiempo del último correo enviado
sendEmail(message="Prueba para verificar que el servidor de correo funcione correctamente", subject="EMAIL TEST SERVER")
const checkConnections = async () => {
  try {
    const response = await axios.get(process.env.CHECK_URL, {
      headers: {
        "X-Token": process.env.TOKEN_SMARTOLT
      }
    });
    
    const test = response.data.response;
    if (Array.isArray(test)) {
      console.log("Nueva revision");
      const filtered = test.filter(t => t.status === "LOS");
      const losCount = filtered.length;
      console.log(`Caidos actuales ${losCount}`)
      // Verificar si hay más de 10 caídas
      if (losCount > process.env.MINIMAS_CONEXIONES) {
        const currentTime = Date.now();
        // Si se ha enviado un correo anteriormente y han pasado más de 60 minutos
        if (!lastEmailSentTime || (currentTime - lastEmailSentTime) > process.env.TIME_INTERVAL_EMAIL) {
          const boardPortCount = {};
          // Contar combinaciones de board y port
          filtered.forEach(c => {
            const key = `${c.board}-${c.port}`;
            boardPortCount[key] = (boardPortCount[key] || 0) + 1;
          });

          // Convertir a array y ordenar
          const sortedBoardPortCounts = Object.entries(boardPortCount)
            .filter(([key, count]) => count > 0) // Filtrar solo los que tienen más de 1
            .sort(([, countA], [, countB]) => countB - countA); // Ordenar de mayor a menor

          let emailMessage = `Resumen de las ${losCount} conexiones en LOS:\n\n`;
          sortedBoardPortCounts.forEach(([key, count]) => {
            const [board, port] = key.split('-');
            emailMessage += `Hay ${count} conexiones caídas en la board ${board} y puerto ${port}\n`;
            console.log(`Hay ${count} conexiones caídas en la board ${board} y puerto ${port}`);
          });
          sendEmail(emailMessage, subject=process.env.SUBJECT_EMAIL);
          lastEmailSentTime = currentTime; // Actualiza el tiempo del último correo enviado
        }
      } else {
        if (lastEmailSentTime) {
          console.log("Los LOS son 9 o menos.");
        }
      }

      // Mantener el intervalo de consulta en 3 minutos
      setTimeout(checkConnections, process.env.TIME_INTERVAL_REQUEST);
    } else {
      console.error('La respuesta no es un arreglo:', response.data);
    }
  } catch (error) {
    console.error('Error al consultar la API:', error);
  }
};

// Inicia el primer chequeo
checkConnections();
