import db, { populate } from './db';

var sg = require('sendgrid')(process.env.SG_API_KEY);

const populateDb = false;
const send = true;

if (populateDb) { populate(); }

export const series = [
  { days: 0,  templateID: 'db6d9991-5136-4fba-82ef-6c5e98649caf' }, 
  { days: 1,  templateID: 'ef3d3c2c-f6f1-4057-8389-f82e071c7f5c' }, 
  { days: 5,  templateID: '3fb326bd-ae78-40d0-9622-0fdf1cc0d235' }, 
  { days: 15, templateID: 'bd9955e3-19eb-4bb0-a669-dc42a79cec6f' }, 
  { days: 30, templateID: '3b9986aa-ee99-4f18-9693-d6ac29064f11' }
];

if (send) { main(); }

function main() {
  var counter = 0;
  series.forEach(({ days, templateID }) => {
    getUsers(days).then(users => {
      sendEmails(users, templateID, () => {
        counter++;

        if (counter == series.length) {
          process.exit();
        }
      });
    });
  });
}

// Retreives all users that were created a certain number of days ago
function getUsers(daysAgo) {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const endDate = new Date(today - (daysAgo * 24 * 60 * 60 * 1000));
    const startDate = new Date(endDate - (24 * 60 * 60 * 1000));

    db.models.user.findAll({ where: {
      createdAt: { 
        $gt: startDate,
        $lt: endDate
      }
    }}).then(users => {
      var userList = users.map(({ email, firstName, lastName }) => {
        return { email, firstName, lastName };
      });

      resolve(userList);
    });
  });
}

function sendEmails(users, templateID, callback) {
  if (users.length == 0) { return callback(); }

  var body = prepareEmail(users, templateID);
  var request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body
  });

  sg.API(request, function (error, response) {
    if (error) {
      console.log('Error response received');
      callback();
    }
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
    return callback();
  });
}

function prepareEmail(recipients, templateID) {
  const senderEmail = 'sender@example.com';
  const senderName = 'Sender Name';

  var emailBody = {
    personalizations: preparePersonalizations(recipients),
    from: { email: senderEmail, name: senderName },
    template_id: templateID
  }

  return emailBody;
}

// Would need to adjust if more than 1000 recipients in any email
function preparePersonalizations(recipients) {
  const subject = "Your Awesome Subject Line";
  
  return recipients.map(({ email, firstName, lastName }) => {
    const name = `${firstName} ${lastName}`;

    var personalization = {
      to: [{ email, name }],
      subject,
      substitutions: { FIRST_NAME: firstName }
    }
    
    return personalization;
  });
}