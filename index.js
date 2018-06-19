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
  const series = await getEmailSeries();
  await executeSeries(series);
  process.exit();    
}

// Retreive emails series and related data from DB
async function getEmailSeries() {
  const series = await db.models.emailSeries.findAll();
  return await prepareSeries(series);
}

// Convert series into an array of structured data
async function prepareSeries(series) {
  var outputSeries = []

  for (var i = 0; i < series.length; i++) {
    const stages = await series[i].getStages()
    const seriesWithStages = {
      id: series[i].id,
      label: series[i].label,
      stages: prepareStages(stages)
    };

    outputSeries.push(seriesWithStages);
  }

  return outputSeries;
}

// Convert stages of series into structured data
function prepareStages(stages) {
  return stages.map(({ label, daysToSend, sgTemplateID }) => {
    return { label, daysToSend, sgTemplateID };
  });
}

// Loop through series to send appropriate emails
async function executeSeries(series) {
  for (var i = 0; i < series.length; i++) {
    await executeStages(series[i].id, series[i].stages)
  }
}

// Loop through stages to send appropriate emails
async function executeStages(seriesID, stages) {
  for (var i = 0; i < stages.length; i++) {
    const { daysToSend, sgTemplateID } = stages[i];
    var users = await getUsers(daysToSend, seriesID)
    await sendEmails(users, sgTemplateID)
  }
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
async function prepareUsers(userSeries) {
  var userList = [];
  
  for (var i = 0; i < userSeries.length; i++) {
    const userId = userSeries[i].userId;
    const { email, firstName, lastName } = await db.models.user.findById(userId);
    userList.push({ email, firstName, lastName });
  }

  return userList;
}

// Sends the appropriate emails to the list of users that should receive them
async function sendEmails(users, templateID) {
  if (users.length == 0 || !send) { return; }
  await sgMail.send(prepareEmail(users, templateID));
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