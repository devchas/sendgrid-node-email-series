import db, { populate } from './db';
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SG_API_KEY);
sgMail.setSubstitutionWrappers('{{', '}}'); // Configure the substitution tag wrappers globally

const populateDb = false;
const runMain = true;
const send = true;

if (populateDb) { populate(); }
if (runMain) { main(); }

// Get and loops through each series of emails
async function main() {
  let series = await db.models.emailSeries.findAll();
  series = await prepareSeries(series);

  await executeSeries(series);

  process.exit();
}

function executeSeries(series) {
  return Promise.all(series.map(async series => {
    await executeStages(series.id, series.stages);
  }));
}

// Convert series into an array of structured data
function prepareSeries(series) {
  return Promise.all(series.map(async series => {
    const stages = await series.getStages();
    return {
      id: series.id,
      label: series.label,
      stages: prepareStages(stages)
    };
  }));
}

// Convert stages of series into structured data
function prepareStages(stages) {
  return stages.map(({ label, daysToSend, sgTemplateID }) => {
    return { label, daysToSend, sgTemplateID };
  });
}

// Loop through stages to send appropriate emails
async function executeStages(seriesID, stages) {
  return Promise.all(stages.map(async stage => {
    const { daysToSend, sgTemplateID } = stage;
    const users = await getUsers(daysToSend, seriesID);
    await sendEmails(users, sgTemplateID)
  }));
}

// Retreives all users from the DB that were created a given number of days ago
async function getUsers(daysAgo, seriesID) {
  const dailyMilliseconds = 24 * 60 * 60 * 1000;
  const today = new Date();
  const endDate = new Date(today - (daysAgo * dailyMilliseconds));
  const startDate = new Date(endDate - dailyMilliseconds);

  const userSeries = await db.models.userSeries.findAll({ where: {
    startDate: { $gt: startDate, $lt: endDate },
    stopEmails: false,
    emailSeryId: seriesID
  }});

  var userList = [];
  if (userSeries.length > 0) { userList = await prepareUsers(userSeries); }

  return userList;
}

// Returns structured array of users based on the email series returned from the DB
function prepareUsers(userSeries) {
  return Promise.all(userSeries.map(async userSeries => {
    const userId = userSeries.userId;
    const { email, firstName, lastName } = await db.models.user.findById(userId);
    return { email, firstName, lastName };
  }));
}

// Sends the appropriate emails to the list of users that should receive them
async function sendEmails(users, templateID) {
  if (users.length == 0) { return; }
  const email = prepareEmail(users, templateID);

  if (send) { await sgMail.send(email); }
}

// Prepares the body of the email per SendGrid documentation
function prepareEmail(recipients, template_id) {
  const email = 'sender@example.com';
  const name = 'Sender Name';
  const personalizations = preparePersonalizations(recipients);
  return { personalizations, from: { email, name }, template_id }
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
