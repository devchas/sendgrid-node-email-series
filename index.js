import db, { populate } from './db';
import _ from 'lodash';
import util from 'util';

import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SG_API_KEY);
sgMail.setSubstitutionWrappers('{{', '}}'); // Configure the substitution tag wrappers globally

const populateDb = false;
const runMain = true;
const send = true;

if (populateDb) { populate(); }

if (runMain) { main(); }

// Get and loops through each series of emails
function main() {
  getEmailSeries().then(series => {
    executeSeries(series, 0, () => {
      process.exit();
    });
  });
}

// Retreive emails series and related data from DB
function getEmailSeries() {
  return new Promise((resolve, reject) => {
    db.models.emailSeries.findAll().then(series => {
      prepareSeries(series, 0, [], outputSeries => {
        resolve(outputSeries);
      });
    });
  });
}

// Convert series into an array of structured data
function prepareSeries(series, i=0, outputSeries=[], callback) {
  if (i == series.length) { return callback(outputSeries); }

  series[i].getStages().then(stages => {
    const seriesWithStages = {
      id: series[i].id,
      label: series[i].label,
      stages: prepareStages(stages)
    };

    outputSeries.push(seriesWithStages);
    i++;
    prepareSeries(series, i, outputSeries, callback);
  });
}

// Convert stages of series into structured data
function prepareStages(stages) {
  return stages.map(({ label, daysToSend, sgTemplateID }) => {
    return { label, daysToSend, sgTemplateID };
  });
}

// Loop through series to send appropriate emails
function executeSeries(series, i=0, callback) {
  if (i == series.length) { return callback(); }

  executeStages(series[i].id, series[i].stages, 0, () => {
    i++;
    executeSeries(series, i, callback);
  });
}

// Loop through stages to send appropriate emails
function executeStages(seriesID, stages, i=0, callback) {
  if (i == stages.length) { return callback(); }

  const { daysToSend, sgTemplateID } = stages[i];

  getUsers(daysToSend, seriesID).then(users => {
    sendEmails(users, sgTemplateID, () => {
      i++;
      executeStages(seriesID, stages, i, callback);
    });
  });
}

// Retreives all users from the DB that were created a given number of days ago
function getUsers(daysAgo, seriesID) {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const endDate = new Date(today - (daysAgo * 24 * 60 * 60 * 1000));
    const startDate = new Date(endDate - (24 * 60 * 60 * 1000));

    db.models.userSeries.findAll({ where: {
      startDate: { $gt: startDate, $lt: endDate },
      stopEmails: false,
      emailSeryId: seriesID
    }}).then(userSeries => {
      if (userSeries.length > 0) {
        prepareUsers(userSeries, 0, [], userList => {
          resolve(userList);
        });
      } else {
        resolve([]);
      }
    });
  });
}

// Returns structured array of users based on the email series returned from the DB
function prepareUsers(userSeries, i=0, userList=[], callback) {
  if (i == userSeries.length) { return callback(userList); }

  const userId = userSeries[i].userId;

  db.models.user.findById(userId).then(({ email, firstName, lastName }) => {
    userList.push({ email, firstName, lastName });
    i++;
    prepareUsers(userSeries, i, userList, callback);
  });
}

// Sends the appropriate emails to the list of users that should receive them
function sendEmails(users, templateID, callback) {
  if (users.length == 0) { return callback(); }

  const msg = prepareEmail(users, templateID);
  sgMail.send(msg, (error, response) => {
    if (error) {
      console.log('Error', error.toString());
    }
    return callback();
  });
}

// Prepares the body of the email per SendGrid documentation
function prepareEmail(recipients, templateID) {
  var emailBody = {
    personalizations: preparePersonalizations(recipients),
    from: { email: 'sender@example.com', name: 'Sender Name' },
    template_id: templateID
  }
  return emailBody;
}

// Prepare personalizations part of parameter for SendGrid API call
// Would need to adjust if more than 1000 recipients in any email
function preparePersonalizations(recipients) {
  return recipients.map(({ email, firstName, lastName }) => {
    const name = `${firstName} ${lastName}`;
    var personalization = {
      to: [{ email, name }],
      substitutions: { firstName }
    }
    return personalization;
  });
}