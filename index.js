import db, { populate } from './db';
import _ from 'lodash';

var sg = require('sendgrid')(process.env.SG_API_KEY);

const populateDb = false;
const send = true;

if (populateDb) { populate(); }

export const series = [
  {
    seriesName: 'welcome',
    seriesData: [
      { days: 0,  templateIDs: ['db6d9991-5136-4fba-82ef-6c5e98649caf'] }, 
      { days: 1,  templateIDs: ['ef3d3c2c-f6f1-4057-8389-f82e071c7f5c', 'fa7cd0e1-331f-4c14-8db2-24cd2de62b84'] },
      { days: 5,  templateIDs: ['3fb326bd-ae78-40d0-9622-0fdf1cc0d235'] }, 
      { days: 15, templateIDs: ['bd9955e3-19eb-4bb0-a669-dc42a79cec6f'] }, 
      { days: 30, templateIDs: ['3b9986aa-ee99-4f18-9693-d6ac29064f11'] }
    ]
  },
  {
    seriesName: 'firstPurchase',
    seriesData: [
      { days: 0,  templateIDs: ['db6d9991-5136-4fba-82ef-6c5e98649caf'] }, 
      { days: 1,  templateIDs: ['ef3d3c2c-f6f1-4057-8389-f82e071c7f5c', 'fa7cd0e1-331f-4c14-8db2-24cd2de62b84'] },
      { days: 5,  templateIDs: ['3fb326bd-ae78-40d0-9622-0fdf1cc0d235'] }, 
      { days: 15, templateIDs: ['bd9955e3-19eb-4bb0-a669-dc42a79cec6f'] }, 
      { days: 30, templateIDs: ['3b9986aa-ee99-4f18-9693-d6ac29064f11'] }
    ]    
  }
];

if (send) { main(); }

// Loops through each series of emails
function main(i = 0) {
  executeSeries(series[i], 0, () => {
    i++;
    if (i == series.length) {
      process.exit();
    } else {
      main(i);
    }
  });
}

// Retreives users and send emails for a given series of emails,
// such as 'welcome series' or 'first purchase series'
function executeSeries(series, i = 0, callback) {
  const { days, templateIDs } = series.seriesData[i];

  getUsers(days, series.seriesName).then(users => {
    sendEmails(users, templateIDs, () => {
      i++;
      if (i == series.seriesData.length) {
        callback();
      } else {
        executeSeries(series, i, callback);
      } 
    });
  });
}

// Retreives all users from the DB that were created a given number of days ago
function getUsers(daysAgo, seriesName) {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const endDate = new Date(today - (daysAgo * 24 * 60 * 60 * 1000));
    const startDate = new Date(endDate - (24 * 60 * 60 * 1000));

    db.models.emailSeries.findAll({ where: {
      createdAt: { $gt: startDate, $lt: endDate },
      stopEmails: false,
      seriesName
    }}).then(emailSeries => {
      if (emailSeries.length > 0) {
        prepareUsers(emailSeries, 0, userList => {
          resolve(userList);
        });
      } else {
        resolve([]);
      }
    });
  });
}

// Returns structured array of users based on the email series returned from the DB
function prepareUsers(emailSeries, i = 0, callback) {
  var userList = [];
  var email = emailSeries[i];

  const templateVersion = email.templateVersion;

  email.getUser().then(({ email, firstName, lastName }) => {
    userList.push({ email, firstName, lastName, templateVersion });
    i++;

    if (i == emailSeries.length) {
      callback(userList);
    } else {
      prepareUsers(emailSeries, i, callback);
    }
  });
}

// Sends the appropriate emails to the list of users that should receive them
function sendEmails(users, templateIDs, callback) {
  if (users.length == 0) { return callback(); }

  var templateCount = 0;
  var numberOfTemplates = templateIDs.length;

  templateIDs.forEach((templateID, index) => {
    const usersToReceiveGivenTemplate = _.filter(users, { 'templateVersion': index });
    if (usersToReceiveGivenTemplate.length > 0) {
      var body = prepareEmail(usersToReceiveGivenTemplate, templateIDs[index]);
      var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body
      });

      sg.API(request, function (error, response) {
        templateCount++;
        if (error) {
          console.log('Error response received');
          if (templateCount == numberOfTemplates) { return callback(); }
        }
        console.log(response.statusCode);
        console.log(response.body);
        console.log(response.headers);
        if (templateCount == numberOfTemplates) { return callback(); }
      });
    } else {
      templateCount++;
      if (templateCount == numberOfTemplates) { return callback(); }
    }
  });
}

// Prepares the body of the email per SendGrid documentation
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

// Prepare personalizations part of parameter for SendGrid API call
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